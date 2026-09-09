"""
Analysis of an uploaded order export.

Answers the questions a small retailer actually has and cannot answer from a
spreadsheet: which customers are worth keeping, which are slipping away, and
whether the export is even good enough to support the answer.

Every query here is scoped by dataset_id and parameterised. The uploaded data
never becomes part of a SQL string.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Standard RFM segment names. These are the industry-conventional buckets, so a
# marketer reading the output already knows what to do with each one.
SEGMENT_ACTIONS = {
    "Champions": "Best customers. Reward them, ask for reviews, and test new products here first.",
    "Loyal": "Buy often and recently. Upsell adjacent categories; they will try things.",
    "Potential Loyalist": "Recent and promising. A second purchase soon is what converts them — nudge it.",
    "New Customers": "Just bought for the first time. Onboarding and a reason to return within 30 days.",
    "Promising": "Recent, low spend so far. Low-cost nudges; do not spend heavily yet.",
    "Need Attention": "Above-average value but slipping. Personal outreach before they lapse.",
    "At Risk": "Spent well, now going quiet. This is where win-back budget earns the most.",
    "Cannot Lose Them": "Your highest-value lapsers. Worth a manual, individual approach.",
    "Hibernating": "Long gone, low value. Cheap reactivation only, or leave them.",
    "Lost": "Very old, very low value. Suppress from paid channels — they cost more than they return.",
}


def _segment_case() -> str:
    """RFM quintile scores to segment names, as SQL."""
    return """
        CASE
          WHEN r >= 4 AND f >= 4 AND m >= 4 THEN 'Champions'
          WHEN r >= 3 AND f >= 4              THEN 'Loyal'
          WHEN r >= 4 AND f >= 2 AND f < 4    THEN 'Potential Loyalist'
          WHEN r = 5  AND f = 1               THEN 'New Customers'
          WHEN r >= 4 AND f = 1               THEN 'Promising'
          WHEN r = 3  AND f <= 3              THEN 'Need Attention'
          WHEN r = 2  AND f >= 2 AND m >= 3   THEN 'At Risk'
          WHEN r <= 2 AND f >= 4 AND m >= 4   THEN 'Cannot Lose Them'
          WHEN r <= 2 AND f >= 2              THEN 'Hibernating'
          ELSE 'Lost'
        END
    """


RFM_SQL = f"""
WITH bounds AS (
    SELECT max(order_date) AS as_of FROM uploaded_orders WHERE dataset_id = :ds
),
per_customer AS (
    SELECT external_customer_id AS customer,
           EXTRACT(EPOCH FROM ((SELECT as_of FROM bounds) - max(order_date))) / 86400 AS recency_days,
           count(*)     AS frequency,
           sum(amount)  AS monetary
    FROM uploaded_orders
    WHERE dataset_id = :ds
    GROUP BY external_customer_id
),
scored AS (
    SELECT *,
           -- Recency is reversed: the most recent buyers score 5.
           6 - ntile(5) OVER (ORDER BY recency_days)          AS r,
           ntile(5) OVER (ORDER BY frequency, monetary)       AS f,
           ntile(5) OVER (ORDER BY monetary)                  AS m
    FROM per_customer
)
SELECT {_segment_case()}   AS segment,
       count(*)                          AS customers,
       sum(monetary)::numeric(16,2)      AS revenue,
       avg(monetary)::numeric(14,2)      AS avg_value,
       avg(frequency)::numeric(8,2)      AS avg_orders,
       avg(recency_days)::numeric(10,1)  AS avg_recency_days
FROM scored
GROUP BY 1
ORDER BY revenue DESC
"""


COHORT_SQL = """
WITH first_order AS (
    SELECT external_customer_id AS customer,
           date_trunc('month', min(order_date)) AS cohort_month
    FROM uploaded_orders WHERE dataset_id = :ds
    GROUP BY external_customer_id
),
activity AS (
    SELECT DISTINCT f.customer, f.cohort_month,
           (EXTRACT(YEAR  FROM age(date_trunc('month', o.order_date), f.cohort_month)) * 12
          + EXTRACT(MONTH FROM age(date_trunc('month', o.order_date), f.cohort_month)))::int AS month_index
    FROM first_order f
    JOIN uploaded_orders o
      ON o.external_customer_id = f.customer AND o.dataset_id = :ds
)
SELECT cohort_month::date AS cohort, month_index, count(*) AS customers
FROM activity
WHERE month_index BETWEEN 0 AND 8
GROUP BY 1, 2 ORDER BY 1, 2
"""


def rfm_segments(db: Session, dataset_id: str) -> list[dict[str, Any]]:
    rows = db.execute(text(RFM_SQL), {"ds": dataset_id}).mappings().all()
    return [
        {
            "segment": r["segment"],
            "customers": int(r["customers"]),
            "revenue": float(r["revenue"] or 0),
            "avg_value": float(r["avg_value"] or 0),
            "avg_orders": float(r["avg_orders"] or 0),
            "avg_recency_days": float(r["avg_recency_days"] or 0),
            "action": SEGMENT_ACTIONS.get(r["segment"], ""),
        }
        for r in rows
    ]


def cohort_matrix(db: Session, dataset_id: str) -> list[dict[str, Any]]:
    rows = db.execute(text(COHORT_SQL), {"ds": dataset_id}).mappings().all()
    by_cohort: dict[str, dict[int, int]] = {}
    for r in rows:
        by_cohort.setdefault(str(r["cohort"]), {})[r["month_index"]] = int(r["customers"])

    matrix = []
    for cohort, cells in sorted(by_cohort.items()):
        base = cells.get(0, 0)
        if base < 5:      # too small to read anything into
            continue
        matrix.append({
            "cohort": cohort,
            "size": base,
            "retention": [
                {"month": i, "customers": cells.get(i, 0),
                 "pct": round(cells.get(i, 0) / base * 100, 1) if base else 0.0}
                for i in range(0, 9)
            ],
        })
    return matrix


def quality_report(db: Session, dataset_id: str, parse_report: dict[str, Any]) -> dict[str, Any]:
    """What this export can and cannot support, stated before any conclusions."""
    stats = db.execute(text("""
        SELECT count(*)                                   AS orders,
               count(DISTINCT external_customer_id)       AS customers,
               min(order_date)                            AS first_order,
               max(order_date)                            AS last_order,
               sum(amount)::numeric(16,2)                 AS revenue,
               count(*) FILTER (WHERE amount <= 0)        AS non_positive,
               count(*) FILTER (WHERE status IS NOT NULL) AS with_status
        FROM uploaded_orders WHERE dataset_id = :ds
    """), {"ds": dataset_id}).mappings().one()

    orders = int(stats["orders"])
    customers = int(stats["customers"])
    span_days = 0
    if stats["first_order"] and stats["last_order"]:
        span_days = (stats["last_order"] - stats["first_order"]).days

    repeat = db.execute(text("""
        SELECT count(*) FROM (
            SELECT external_customer_id FROM uploaded_orders
            WHERE dataset_id = :ds GROUP BY 1 HAVING count(*) > 1
        ) q
    """), {"ds": dataset_id}).scalar() or 0

    checks = []

    # Enough history for cohort work?
    checks.append({
        "name": "Enough history for retention analysis",
        "status": "pass" if span_days >= 120 else "warn",
        "detail": f"The export spans {span_days} days "
                  f"({stats['first_order'].date() if stats['first_order'] else '—'} to "
                  f"{stats['last_order'].date() if stats['last_order'] else '—'}).",
        "consequence": "Cohort retention needs several months to show a trend. Under about four "
                       "months, month-on-month movement is mostly noise."
                       if span_days < 120 else
                       "Long enough to read a retention curve.",
    })

    # Enough repeat purchasing for RFM to mean anything?
    repeat_pct = round(repeat / customers * 100, 1) if customers else 0.0
    checks.append({
        "name": "Repeat purchasing present",
        "status": "pass" if repeat_pct >= 10 else "warn",
        "detail": f"{repeat:,} of {customers:,} customers ({repeat_pct}%) ordered more than once.",
        "consequence": "Frequency scores separate customers meaningfully."
                       if repeat_pct >= 10 else
                       "With this little repeat purchasing, the F in RFM barely varies — treat "
                       "frequency-based segments with caution and lean on recency and value.",
    })

    # Rows the parser could not use.
    skipped = parse_report.get("skipped_total", 0)
    skipped_pct = round(skipped / (orders + skipped) * 100, 1) if (orders + skipped) else 0.0
    checks.append({
        "name": "Rows parsed cleanly",
        "status": "pass" if skipped_pct < 5 else "warn",
        "detail": f"{orders:,} rows used, {skipped:,} skipped ({skipped_pct}%): "
                  f"{parse_report.get('skipped')}.",
        "consequence": "Nothing material was dropped." if skipped_pct < 5 else
                       "A meaningful share of rows was unusable. Check the column mapping before "
                       "trusting totals — revenue here excludes them.",
    })

    # Refunds and cancellations distort revenue if status is absent.
    checks.append({
        "name": "Order status available",
        "status": "pass" if int(stats["with_status"]) > 0 else "warn",
        "detail": f"{int(stats['with_status']):,} of {orders:,} rows carry a status value.",
        "consequence": "Status is present, so refunds and cancellations can be excluded."
                       if int(stats["with_status"]) > 0 else
                       "No status column was mapped, so refunded and cancelled orders are counted "
                       "as revenue. Totals here are gross, not net.",
    })

    return {
        "summary": {
            "orders": orders,
            "customers": customers,
            "revenue": float(stats["revenue"] or 0),
            "span_days": span_days,
            "first_order": stats["first_order"].isoformat() if stats["first_order"] else None,
            "last_order": stats["last_order"].isoformat() if stats["last_order"] else None,
            "repeat_customers": int(repeat),
            "repeat_pct": repeat_pct,
            "non_positive_amounts": int(stats["non_positive"]),
        },
        "checks": checks,
        "passing": sum(1 for c in checks if c["status"] == "pass"),
        "total": len(checks),
    }
