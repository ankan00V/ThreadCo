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

import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.sqlguard import (
    SqlGuardError, get_trusted_engine, readonly_available, run_query,
)

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
        return run_query(request.query)
    except SqlGuardError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # Surface the database's own message (statement timeout, syntax error,
        # permission denied) — it is more useful to the reader than a generic 500.
        raise HTTPException(status_code=400, detail=str(exc).splitlines()[0][:300]) from exc
