"""
Query Performance Lab.

Six paired queries that each answer the same business question two ways: the
way it gets written first, and the way it has to be written once the table is
large. Both sides run live against the real 1M-row dataset through the
read-only role, and both report PostgreSQL's own Execution Time rather than
wall clock, so the numbers are not just measuring the round trip to Neon.

The pairs were not invented for the demo — every "naive" query here is a
pattern that was actually in this codebase before the dataset grew.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.plan_explain import explain_plan
from app.sqlguard import (
    SqlGuardError, get_trusted_engine, readonly_available, run_query,
)

logger = logging.getLogger("xeno-crm.perf")
router = APIRouter(prefix="/api/perf", tags=["performance"])


class CaseStudy(BaseModel):
    id: str
    title: str
    question: str
    diagnosis: str
    fix: str
    caveat: str | None = None
    naive_sql: str
    optimized_sql: str
    naive_label: str = "Written the obvious way"
    optimized_label: str = "Written for the access path"
    # Some wins are not measured in milliseconds. `transfer` cases are judged on
    # how many rows cross the wire, and reporting a speedup for them would be
    # actively misleading.
    primary_metric: str = "time"
    # Run before the optimized query and substituted into it, so that fetching a
    # keyset cursor is not charged to the query being measured. A real client
    # already holds this value from the previous page.
    cursor_sql: str | None = None


CASES: list[CaseStudy] = [
    CaseStudy(
        id="deep-pagination",
        title="Deep pages of the order log",
        question="Show 20 orders from deep inside the history — the "
                 "kind of request an ops user makes by clicking to a late page.",
        diagnosis="Both queries use the same index. OFFSET is not a seek — Postgres still "
                  "walks and discards every preceding index entry before returning 20 rows, so "
                  "cost grows linearly with page depth. The index was never the problem.",
        fix="Keyset (seek) pagination: remember the last row's sort key and ask for rows "
            "after it. Constant time at any depth.",
        caveat="Keyset cannot jump to an arbitrary page number — it only moves forward and "
               "back from a cursor. That is a real product trade-off, not a free win.",
        naive_sql="""SELECT id, amount, created_at
FROM orders
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET {deep_offset}""",
        optimized_sql="""SELECT id, amount, created_at
FROM orders
WHERE (created_at, id) < (timestamptz '{cursor_created_at}', uuid '{cursor_id}')
ORDER BY created_at DESC, id DESC
LIMIT 20""",
        cursor_sql="""SELECT created_at AS cursor_created_at, id AS cursor_id
FROM orders ORDER BY created_at DESC, id DESC LIMIT 1 OFFSET {deep_offset}""",
        naive_label="Deep OFFSET",
        optimized_label="Keyset / seek",
    ),
    CaseStudy(
        id="unnecessary-join",
        title="Revenue by city",
        question="Which cities generate the most completed-order revenue?",
        diagnosis="The first version joins {orders} orders to {customers} customers to read a `city` "
                  "column that already exists on `orders`. The join is pure cost: it forces "
                  "a hash join and a much larger intermediate result.",
        fix="Read `city` off the table that already stores it. Know the schema before "
            "reaching for a join.",
        caveat="These two are only equivalent because the seed keeps orders.city consistent "
               "with the customer's city. If a customer can order from another city, they "
               "answer different questions — and 'revenue by city' would need defining.",
        naive_sql="""SELECT c.city, count(*) AS orders, sum(o.amount) AS revenue
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'completed'
GROUP BY c.city
ORDER BY revenue DESC""",
        optimized_sql="""SELECT city, count(*) AS orders, sum(amount) AS revenue
FROM orders
WHERE status = 'completed'
GROUP BY city
ORDER BY revenue DESC""",
        naive_label="Join to customers",
        optimized_label="Use orders.city",
    ),
    CaseStudy(
        id="monthly-rollup",
        title="Monthly revenue trend",
        question="Plot completed-order revenue by month for the last 12 months. This runs on "
                 "every single dashboard load.",
        diagnosis="Aggregating {orders} rows on every page view. It is correct, and it is wasted "
                  "work: the answer only changes when new orders land.",
        fix="Pre-aggregate into a materialized view keyed by month, and read 25 rows instead "
            "of scanning a million.",
        caveat="A materialized view is stale between refreshes. REFRESH MATERIALIZED VIEW "
               "CONCURRENTLY on this dataset takes about a second, so the honest trade is 'dashboard "
               "is up to N minutes behind' — which is fine for a revenue trend and would not "
               "be fine for a live delivery counter.",
        naive_sql="""SELECT date_trunc('month', created_at) AS month, sum(amount) AS revenue
FROM orders
WHERE status = 'completed' AND created_at >= now() - interval '365 days'
GROUP BY 1
ORDER BY 1""",
        optimized_sql="""SELECT month, revenue
FROM mv_revenue_monthly
WHERE month >= now() - interval '365 days'
ORDER BY month""",
        naive_label="Aggregate {orders} rows",
        optimized_label="Materialized rollup",
    ),
    CaseStudy(
        id="text-search",
        title="Customer search box",
        question="Find customers whose name or email contains what the user typed.",
        diagnosis="A leading wildcard ('%term%') cannot use a B-tree index, so every "
                  "keystroke sequentially scans {customers} customers. Counting all matches is the "
                  "honest measurement — it cannot exit early.",
        fix="A GIN index with pg_trgm on the concatenated searchable text. Trigram matching "
            "supports leading wildcards.",
        caveat="This one is nuanced: for a COMMON term with LIMIT 20, the naive query is "
               "already fast because it stops as soon as it finds 20 matches. The index earns "
               "its keep on rare terms, and on counting. Quoting the best-case "
               "speedup here would be misleading.",
        naive_sql="""SELECT count(*)
FROM customers
WHERE name ILIKE '%sharm%' OR email ILIKE '%sharm%'""",
        optimized_sql="""SELECT count(*)
FROM customers
WHERE (name || ' ' || email) ILIKE '%sharm%'""",
        naive_label="ILIKE, no usable index",
        optimized_label="pg_trgm GIN",
    ),
    CaseStudy(
        id="pagination-count",
        title="'Showing 1-20 of N' on the customer directory",
        question="How many customers match the current filter? Needed to render the pager.",
        diagnosis="An exact COUNT(*) has to touch every matching row. On an unfiltered "
                  "directory that is the whole table, on every page load, just to draw a number "
                  "almost nobody reads precisely.",
        fix="Use the planner's own row estimate for the unfiltered case and reserve exact "
            "counts for narrow filters.",
        caveat="The estimate is approximate and drifts until the next ANALYZE. It is the right "
               "call for 'about 145,000 customers' and the wrong call for anything financial or "
               "anything a user reconciles against another number.",
        naive_sql="SELECT count(*) FROM customers WHERE is_active = true",
        optimized_sql="""SELECT reltuples::bigint AS approx_customers
FROM pg_class WHERE relname = 'customers'""",
        naive_label="Exact COUNT(*)",
        optimized_label="Planner estimate",
    ),
    CaseStudy(
        id="app-side-aggregation",
        title="Lifecycle tag distribution",
        question="How many customers sit in each behavioural tag (vip / loyal / churned / new)?",
        diagnosis="The original code fetched every customer's tag array into Python and counted "
                  "them in a dict. Server time looks fine; the cost is every one of the {customers} rows crossing the "
                  "network and being held in application memory to produce four numbers.",
        fix="Aggregate where the data already is: unnest the array and GROUP BY in SQL. Four "
            "rows cross the wire.",
        caveat="Server-side execution time is actually HIGHER for the SQL version here — the "
               "work moved onto the database. The win is transfer volume and app memory, which "
               "is what breaks first as the table grows. Measuring only ms would hide that.",
        primary_metric="transfer",
        naive_sql="SELECT tags FROM customers WHERE is_active = true",
        optimized_sql="""SELECT unnest(tags) AS tag, count(*) AS customers
FROM customers
WHERE is_active = true
GROUP BY 1
ORDER BY customers DESC""",
        naive_label="Ship every matching row to the app",
        optimized_label="GROUP BY in SQL",
    ),
    CaseStudy(
        id="partition-pruning",
        title="One month out of two years",
        question="Total completed revenue for a single month — the shape behind every "
                 "month-on-month report.",
        diagnosis="On a plain table the planner reads an index over the whole two-year range "
                  "and filters. It is not slow, but every month-scoped query still consults one "
                  "structure covering every month that exists.",
        fix="RANGE partition by month on created_at. The planner discards the partitions that "
            "cannot contain matching rows before execution starts, so a one-month query opens "
            "one partition instead of the whole table.",
        caveat="The time saved here is modest — the control table is indexed, so it was never "
               "in trouble. Pruning earns its keep elsewhere: retention becomes DROP TABLE "
               "orders_p_2024_09 instead of a DELETE that leaves dead tuples to vacuum, each "
               "partition's index stays small enough to cache, and maintenance runs per month "
               "rather than over everything. The costs are real too — every unique constraint "
               "must include the partition key, and a query WITHOUT a created_at predicate now "
               "touches all 26 partitions instead of one table.",
        naive_sql="""SELECT count(*) AS orders, sum(amount) AS revenue
FROM orders_flat
WHERE created_at >= '2025-10-01' AND created_at < '2025-11-01'""",
        optimized_sql="""SELECT count(*) AS orders, sum(amount) AS revenue
FROM orders_partitioned
WHERE created_at >= '2025-10-01' AND created_at < '2025-11-01'""",
        naive_label="Plain table, indexed",
        optimized_label="Monthly RANGE partitions",
    ),
]

_BY_ID = {c.id: c for c in CASES}


def _deep_offset() -> int:
    """Pick a page depth from the live row count, not a literal.

    Hardcoding OFFSET 900000 would silently return nothing on a smaller
    database. This lands ~90% of the way through whatever is actually there.
    """
    with get_trusted_engine().connect() as conn:
        total = conn.execute(text("SELECT count(*) FROM orders")).scalar() or 0
    return max(int(total * 0.9), 0)


def _resolve_offsets(case_data: dict[str, Any], offset: int) -> dict[str, Any]:
    """Substitute the page depth wherever it appears, leaving other placeholders."""
    for field in ("naive_sql", "optimized_sql", "cursor_sql"):
        if isinstance(case_data.get(field), str):
            case_data[field] = case_data[field].replace("{deep_offset}", str(offset))
    return case_data


_PROSE_FIELDS = ("question", "diagnosis", "fix", "caveat", "naive_label", "optimized_label")


@router.get("/cases")
def list_cases() -> dict[str, Any]:
    """Case metadata, with live row counts substituted into the descriptions.

    Nothing about the dataset size is written down as a literal — the counts come
    from the database on every request, so the copy cannot drift from the data.
    """
    profile = dataset_profile()
    counts = {
        "customers": f"{profile['customers']:,}",
        "orders": f"{profile['orders']:,}",
    }

    offset = _deep_offset()
    cases = []
    for case in CASES:
        data = case.model_dump()
        for field in _PROSE_FIELDS:
            if isinstance(data.get(field), str):
                data[field] = data[field].format(**counts)
        cases.append(_resolve_offsets(data, offset))

    return {
        "dataset": profile,
        "cases": cases,
        "console_enabled": readonly_available(),
    }


def dataset_profile() -> dict[str, Any]:
    """Live row counts and storage, so the reader knows what scale this ran at."""
    engine = get_trusted_engine()
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT (SELECT count(*) FROM customers) AS customers,
                   (SELECT count(*) FROM orders)    AS orders,
                   pg_size_pretty(pg_database_size(current_database())) AS db_size
        """)).mappings().one()
        return dict(rows)


class RunResponse(BaseModel):
    case: CaseStudy
    naive: dict[str, Any]
    optimized: dict[str, Any]
    speedup: float | None


@router.post("/cases/{case_id}/run")
def run_case(case_id: str) -> dict[str, Any]:
    """Execute both sides of a case study live and return real plans and timings."""
    case = _BY_ID.get(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Unknown case '{case_id}'.")

    resolved = _resolve_offsets(case.model_dump(), _deep_offset())
    naive_sql = resolved["naive_sql"]
    optimized_sql = resolved["optimized_sql"]
    cursor_sql = resolved["cursor_sql"]

    if cursor_sql:
        # Untimed: a paginating client already has this from the previous page.
        with get_trusted_engine().connect() as conn:
            cursor = conn.execute(text(cursor_sql)).mappings().one()
        optimized_sql = optimized_sql.format(**{k: str(v) for k, v in cursor.items()})

    try:
        naive = run_query(naive_sql, trusted=True)
        optimized = run_query(optimized_sql, trusted=True)
    except SqlGuardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    naive["rows_returned"] = _rows_returned(naive)
    optimized["rows_returned"] = _rows_returned(optimized)
    optimized["sql_executed"] = optimized_sql

    speedup = transfer_reduction = None
    if case.primary_metric == "time":
        a, b = naive.get("execution_ms"), optimized.get("execution_ms")
        if a and b and b > 0:
            speedup = round(a / b, 1)
    else:
        a, b = naive["rows_returned"], optimized["rows_returned"]
        if a and b:
            transfer_reduction = round(a / b, 1)

    naive.pop("plan_json", None)
    optimized.pop("plan_json", None)
    naive["sql_executed"] = naive_sql
    return {
        "case": resolved,
        "naive": naive,
        "optimized": optimized,
        "speedup": speedup,
        "transfer_reduction": transfer_reduction,
    }


def _rows_returned(result: dict[str, Any]) -> int | None:
    """Rows the query actually produced, read from the plan's root node.

    `rows` in the payload is capped for the UI, so it cannot be used for this.
    """
    for line in result.get("plan", []):
        # Root node line looks like: "... (actual time=0.01..20.5 rows=145000 loops=1)"
        match = re.search(r"actual time=[\d.]+\.\.[\d.]+ rows=(\d+)", line)
        if match:
            return int(match.group(1))
    return None


class QueryRequest(BaseModel):
    query: str = Field(..., max_length=5000)


@router.post("/query")
def free_query(request: QueryRequest) -> dict[str, Any]:
    """Run reviewer-supplied SQL through the read-only role. See app/sqlguard.py.

    Never falls back to the owner role: if the restricted role is not configured
    the console is disabled instead.
    """
    if not readonly_available():
        raise HTTPException(
            status_code=503,
            detail="The SQL console is disabled because DATABASE_URL_READONLY is not "
                   "configured. It will not fall back to a privileged role.",
        )
    try:
        result = run_query(request.query)
        # Raw EXPLAIN output says what happened; this says what is wrong with it.
        if result.get("plan_json"):
            try:
                result["diagnosis"] = explain_plan(result["plan_json"])
            except Exception:
                logger.warning("Plan diagnosis failed", exc_info=True)
        result.pop("plan_json", None)
        return result
    except SqlGuardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # Surface the database's own message (statement timeout, syntax error,
        # permission denied) — it is more useful to the reader than a generic 500.
        raise HTTPException(status_code=400, detail=str(exc).splitlines()[0][:300]) from exc


# ---------------------------------------------------------------------------
# Schema reference — you cannot write SQL against a database you cannot see
# ---------------------------------------------------------------------------

@router.get("/schema")
def schema_reference() -> dict[str, Any]:
    """Tables, columns, row counts and indexes, read live from the catalog.

    The SQL console is unusable without this: a visitor has no way to know the
    column names, and no way to reason about why their query did or did not use
    an index.
    """
    engine = get_trusted_engine()
    with engine.connect() as conn:
        columns = conn.execute(text("""
            SELECT table_name, column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('customers','orders','campaigns','segments','communications')
            ORDER BY table_name, ordinal_position
        """)).mappings().all()

        counts = conn.execute(text("""
            SELECT relname AS table_name, n_live_tup AS rows,
                   pg_size_pretty(pg_total_relation_size(relid)) AS size
            FROM pg_stat_user_tables
            WHERE relname IN ('customers','orders','campaigns','segments','communications')
        """)).mappings().all()

        indexes = conn.execute(text("""
            SELECT tablename AS table_name, indexname, indexdef,
                   pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename IN ('customers','orders','campaigns','segments','communications')
            ORDER BY tablename, indexname
        """)).mappings().all()

    by_table: dict[str, dict[str, Any]] = {}
    stats = {c["table_name"]: c for c in counts}

    for col in columns:
        t = col["table_name"]
        entry = by_table.setdefault(t, {
            "table": t,
            "rows": int(stats.get(t, {}).get("rows") or 0),
            "size": stats.get(t, {}).get("size") or "—",
            "columns": [],
            "indexes": [],
        })
        entry["columns"].append({
            "name": col["column_name"],
            "type": col["data_type"],
            "nullable": col["is_nullable"] == "YES",
        })

    for idx in indexes:
        t = idx["table_name"]
        if t in by_table:
            definition = idx["indexdef"]
            by_table[t]["indexes"].append({
                "name": idx["indexname"],
                "size": idx["size"],
                # Just the indexed expression, not the whole CREATE statement.
                "on": definition[definition.index("(") :] if "(" in definition else definition,
                "unique": definition.strip().upper().startswith("CREATE UNIQUE"),
            })

    return {"tables": [by_table[t] for t in sorted(by_table)]}


# ---------------------------------------------------------------------------
# Challenges — write a faster query, get scored against the slow one
# ---------------------------------------------------------------------------

class Challenge(BaseModel):
    id: str
    title: str
    task: str
    hint: str
    slow_sql: str
    # Rows the submission must return for the answer to count as correct.
    check_sql: str
    # Values the solver legitimately has but cannot cheaply derive inside the
    # query. Keyset pagination is the case that matters: a real client already
    # holds the previous page's sort key, so requiring the solver to compute it
    # with the OFFSET they are trying to avoid would make the task unsolvable.
    context_sql: str | None = None
    context_label: str | None = None
    # Pass bar, per challenge. A flat threshold is wrong: removing an
    # unnecessary join caps out near 2x, while switching OFFSET for a keyset
    # seek is four orders of magnitude. Holding both to the same bar would make
    # the correct answer to one of them unwinnable.
    pass_speedup: float = 2.0


CHALLENGES: list[Challenge] = [
    Challenge(
        id="recent-orders-page",
        title="Jump to a late page of the order log",
        task="Return the 20 orders immediately after the cursor below, newest first. "
             "Beat the OFFSET version.",
        hint="OFFSET still walks every row it skips. Compare the (created_at, id) tuple against "
             "the cursor instead — Postgres supports row-value comparison directly.",
        context_label="Cursor from the previous page (a real client already has this)",
        context_sql="SELECT created_at, id FROM orders "
                    "ORDER BY created_at DESC, id DESC LIMIT 1 OFFSET 400000",
        pass_speedup=10.0,
        slow_sql="SELECT id, amount, created_at FROM orders ORDER BY created_at DESC, id DESC "
                 "LIMIT 20 OFFSET 400000",
        check_sql="SELECT count(*) FROM ({sql}) q",
    ),
    Challenge(
        id="city-revenue",
        title="Completed revenue by city",
        task="Total completed-order revenue per city. Beat the version that joins to customers.",
        hint="Check the schema — does orders already carry the column you are joining for?",
        pass_speedup=1.5,
        slow_sql="SELECT c.city, sum(o.amount) AS revenue FROM orders o "
                 "JOIN customers c ON c.id = o.customer_id WHERE o.status = 'completed' "
                 "GROUP BY c.city ORDER BY revenue DESC",
        check_sql="SELECT count(*) FROM ({sql}) q",
    ),
    Challenge(
        id="customer-search",
        title="Find customers by a fragment of name or email",
        task="Count customers whose name or email contains 'sharm'. Beat the two-ILIKE version.",
        hint="A leading wildcard cannot use a B-tree. Look at the indexes on customers.",
        pass_speedup=3.0,
        slow_sql="SELECT count(*) FROM customers WHERE name ILIKE '%sharm%' OR email ILIKE '%sharm%'",
        check_sql="SELECT count(*) FROM ({sql}) q",
    ),
]

_CHALLENGE_BY_ID = {c.id: c for c in CHALLENGES}


@router.get("/challenges")
def list_challenges() -> dict[str, Any]:
    """Challenges, with any context values resolved live from the database."""
    engine = get_trusted_engine()
    out = []
    for challenge in CHALLENGES:
        data = challenge.model_dump(exclude={"check_sql", "context_sql"})
        if challenge.context_sql:
            with engine.connect() as conn:
                row = conn.execute(text(challenge.context_sql)).mappings().one()
            data["context"] = {k: str(v) for k, v in row.items()}
        out.append(data)
    return {"challenges": out}


class AttemptRequest(BaseModel):
    query: str = Field(..., max_length=5000)


@router.post("/challenges/{challenge_id}/attempt")
def attempt_challenge(challenge_id: str, request: AttemptRequest) -> dict[str, Any]:
    """Run the submission and the slow reference, and compare honestly.

    Both are timed the same way — PostgreSQL's own Execution Time — and the
    submission has to return the same number of rows, so a 'fast' query that
    answers a different question does not score.
    """
    challenge = _CHALLENGE_BY_ID.get(challenge_id)
    if challenge is None:
        raise HTTPException(status_code=404, detail=f"Unknown challenge '{challenge_id}'.")

    if not readonly_available():
        raise HTTPException(status_code=503, detail="Challenges need DATABASE_URL_READONLY.")

    try:
        submitted = run_query(request.query)
    except SqlGuardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc).splitlines()[0][:300]) from exc

    reference = run_query(challenge.slow_sql, trusted=True)

    mine = submitted.get("execution_ms")
    theirs = reference.get("execution_ms")
    speedup = round(theirs / mine, 1) if mine and theirs and mine > 0 else None

    same_shape = submitted["row_count"] == reference["row_count"]

    return {
        "challenge_id": challenge_id,
        "your_ms": mine,
        "reference_ms": theirs,
        "speedup": speedup,
        "returns_same_row_count": same_shape,
        "passed": bool(same_shape and speedup and speedup >= challenge.pass_speedup),
        "pass_speedup": challenge.pass_speedup,
        "your_result": submitted,
        "verdict": (
            "Different number of rows than the reference — this answers a different question."
            if not same_shape else
            f"{speedup}x faster than the reference." if speedup and speedup >= challenge.pass_speedup else
            f"Correct, but {speedup}x is short of the {challenge.pass_speedup}x bar for this one."
        ),
    }
