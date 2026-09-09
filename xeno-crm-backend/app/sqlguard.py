"""
Defence-in-depth for the browser-facing SQL surface.

An analytics demo is much more convincing if a reviewer can run their own
SQL against the real dataset. That is also the most dangerous thing you can
put on a public URL, so access is layered. Every layer assumes the ones
above it have already been bypassed:

  1. Postgres role       `threadco_readonly` holds SELECT and nothing else.
                         DELETE/UPDATE/CREATE/DROP fail inside the engine,
                         not in application code.
  2. Session defaults    default_transaction_read_only=on, statement_timeout=4s,
                         idle_in_transaction_session_timeout=10s, set with
                         ALTER ROLE so they survive any connection.
  3. Transaction         each request runs in an explicit READ ONLY transaction.
  4. Statement shape     one statement only; must start with SELECT/WITH/EXPLAIN.
  5. Surface denial      catalog, filesystem and large-object functions blocked.
  6. Output cap          rows and cells truncated before serialisation.

Layer 1 is the one that actually matters. The rest exist so an attacker has
to get through several independent things, and so obvious mistakes fail loudly
and early with a clear message instead of silently.
"""

from __future__ import annotations

import os
import re
import time
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

MAX_ROWS = 200
MAX_CELL_CHARS = 500
STATEMENT_TIMEOUT_MS = 4000

# Blocked regardless of role grants: catalog probing, filesystem access,
# and anything that can be turned into a denial-of-service primitive.
_DENY = re.compile(
    r"\b("
    r"pg_catalog|information_schema|pg_shadow|pg_authid|pg_user|pg_roles|"
    r"pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|"
    r"lo_import|lo_export|dblink|pg_sleep|pg_terminate_backend|pg_cancel_backend|"
    r"current_setting|set_config|pg_settings"
    r")\b",
    re.IGNORECASE,
)

_ALLOWED_START = re.compile(r"^\s*(select|with|explain|table)\b", re.IGNORECASE)


class SqlGuardError(ValueError):
    """Raised when a submitted statement is refused before it reaches Postgres."""


def _readonly_url() -> str:
    url = os.getenv("DATABASE_URL_READONLY")
    if url:
        return url
    # Falling back to the owner role would silently remove layer 1, which is
    # the only layer that genuinely constrains a determined caller. Refuse.
    raise SqlGuardError(
        "DATABASE_URL_READONLY is not configured; the SQL console is disabled. "
        "See README — it must point at the least-privilege threadco_readonly role."
    )


_engine = None
_fallback_engine = None


def readonly_available() -> bool:
    return bool(os.getenv("DATABASE_URL_READONLY"))


def get_engine():
    """Engine bound to the least-privilege role. Required for user-supplied SQL."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            _readonly_url(),
            poolclass=NullPool,           # never hold privileged-ish sessions open
            connect_args={"connect_timeout": 10},
        )
    return _engine


def get_trusted_engine():
    """Engine for SERVER-AUTHORED SQL only — the performance case studies.

    Those statements are constants in this repository, never user input, so the
    least-privilege role is defence they do not need. Preferring it anyway when
    it is configured, and falling back otherwise, keeps the Performance Lab
    working on a deployment where DATABASE_URL_READONLY has not been set —
    without ever letting user input reach the fallback.
    """
    if readonly_available():
        return get_engine()

    global _fallback_engine
    if _fallback_engine is None:
        url = os.getenv("DATABASE_URL")
        if not url:
            raise SqlGuardError("Neither DATABASE_URL_READONLY nor DATABASE_URL is set.")
        _fallback_engine = create_engine(
            url, poolclass=NullPool, connect_args={"connect_timeout": 10}
        )
    return _fallback_engine


def strip_sql_comments(sql: str) -> str:
    """Remove comments so they cannot hide a denied token from the checks."""
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    sql = re.sub(r"--[^\n]*", " ", sql)
    return sql


def validate(sql: str) -> str:
    """Return the cleaned statement, or raise SqlGuardError explaining the refusal."""
    if not sql or not sql.strip():
        raise SqlGuardError("Empty query.")

    if len(sql) > 5000:
        raise SqlGuardError("Query is too long (5000 character limit).")

    stripped = strip_sql_comments(sql).strip().rstrip(";").strip()

    if not stripped:
        raise SqlGuardError("Query contained only comments.")

    # One statement only. A trailing semicolon is fine; a second statement is not.
    if ";" in stripped:
        raise SqlGuardError(
            "Only a single statement is allowed. Remove the ';' and everything after it."
        )

    if not _ALLOWED_START.match(stripped):
        raise SqlGuardError(
            "Only SELECT, WITH, TABLE and EXPLAIN statements are accepted. "
            "The connected role has no write privileges either."
        )

    denied = _DENY.search(stripped)
    if denied:
        raise SqlGuardError(
            f"'{denied.group(1)}' is not available in this console. "
            "System catalogs, filesystem access and sleep functions are blocked."
        )

    return stripped


def run_query(sql: str, want_plan: bool = True, trusted: bool = False) -> dict[str, Any]:
    """Validate and execute a read-only statement, returning rows and its plan.

    `trusted=True` is only for SQL authored in this repository (the performance
    case studies). User input must never set it.
    """
    statement = validate(sql)
    engine = get_trusted_engine() if trusted else get_engine()

    with engine.connect() as conn:
        # Layers 2 and 3, restated per transaction rather than trusted from the role.
        conn.execute(text("SET TRANSACTION READ ONLY"))
        conn.execute(text(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}"))

        started = time.perf_counter()
        result = conn.execute(text(statement))
        columns = list(result.keys()) if result.returns_rows else []
        raw = result.fetchmany(MAX_ROWS) if result.returns_rows else []
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        truncated = result.returns_rows and len(raw) == MAX_ROWS

        rows = [
            {c: _clip(v) for c, v in zip(columns, record)}
            for record in raw
        ]

        plan: list[str] = []
        plan_json = None
        planning_ms = execution_ms = None
        if want_plan and not statement.lower().lstrip().startswith("explain"):
            try:
                # ANALYZE is safe here: the role cannot write, and the statement
                # was already validated and executed once under the same timeout.
                pr = conn.execute(text(f"EXPLAIN (ANALYZE, BUFFERS) {statement}"))
                plan = [r[0] for r in pr.fetchall()]
                # JSON form too: the text plan is for reading, the structured one
                # is what the diagnostics in app/plan_explain.py operate on.
                jr = conn.execute(text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) {statement}"))
                plan_json = jr.scalar_one()
                for line in plan:
                    if line.startswith("Planning Time:"):
                        planning_ms = float(line.split(":")[1].strip().split(" ")[0])
                    elif line.startswith("Execution Time:"):
                        execution_ms = float(line.split(":")[1].strip().split(" ")[0])
            except Exception:
                plan = []

        conn.rollback()

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "wall_ms": elapsed_ms,
        "planning_ms": planning_ms,
        "execution_ms": execution_ms,
        "plan": plan,
        "plan_json": plan_json,
    }


def _clip(value: Any) -> Any:
    if isinstance(value, str) and len(value) > MAX_CELL_CHARS:
        return value[:MAX_CELL_CHARS] + "…"
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(value)
