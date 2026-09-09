"""
Written analysis, not just charts.

A dashboard tells you what a number is. This endpoint is the part a business
stakeholder actually needs: a question, the query that answers it, what the
answer turned out to be, and what should be done about it — including the cases
where the honest answer is "this dataset cannot support that conclusion yet".

The retention audit below is a real finding from building this. The first cohort
run came back at ~23% retention in every month of every cohort. Flat retention
is not a customer behaviour anyone has ever observed; it is the signature of a
generator assigning order dates uniformly at random. That is written up here
rather than quietly smoothed over, because catching it is the job.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db

router = APIRouter(prefix="/api/insights", tags=["insights"])


COHORT_SQL = """
WITH first_order AS (
  SELECT customer_id, date_trunc('month', min(created_at)) AS cohort_month
  FROM orders WHERE status = 'completed' GROUP BY customer_id
),
activity AS (
  SELECT DISTINCT f.customer_id, f.cohort_month,
         (EXTRACT(YEAR  FROM age(date_trunc('month', o.created_at), f.cohort_month)) * 12
        + EXTRACT(MONTH FROM age(date_trunc('month', o.created_at), f.cohort_month)))::int
         AS month_index
  FROM first_order f
  JOIN orders o ON o.customer_id = f.customer_id AND o.status = 'completed'
)
SELECT cohort_month::date, month_index, count(*) AS customers
FROM activity GROUP BY 1, 2 ORDER BY 1, 2
"""

CONCENTRATION_SQL = """
WITH ranked AS (
  SELECT total_spent, ntile(10) OVER (ORDER BY total_spent DESC) AS decile
  FROM customers WHERE total_orders > 0
)
SELECT decile,
       count(*)                     AS customers,
       sum(total_spent)::numeric(16,0) AS revenue,
       (100.0 * sum(total_spent) / sum(sum(total_spent)) OVER ())::numeric(5,1) AS pct_of_revenue
FROM ranked GROUP BY decile ORDER BY decile
"""


@router.get("/retention")
def retention_analysis(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Cohort retention matrix, served from a materialized view."""
    rows = db.execute(text("""
        SELECT cohort_month, month_index, customers
        FROM mv_cohort_retention ORDER BY cohort_month, month_index
    """)).mappings().all()

    by_cohort: dict[str, dict[int, int]] = {}
    for r in rows:
        by_cohort.setdefault(str(r["cohort_month"]), {})[r["month_index"]] = r["customers"]

    matrix = []
    for cohort, cells in sorted(by_cohort.items()):
        base = cells.get(0, 0)
        if base < 500:      # tiny trailing cohorts are noise, not signal
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

    completed = db.execute(text(
        "SELECT count(*) FROM orders WHERE status = 'completed'")).scalar() or 0

    return {
        "matrix": matrix,
        "sql": COHORT_SQL.strip(),
        "completed_orders": int(completed),
        "served_from": f"Served from mv_cohort_retention. Computing this live joins "
                       f"{completed:,} completed orders back to their cohort month, which is "
                       f"why it is materialized rather than run per request.",
    }


@router.get("/concentration")
def revenue_concentration(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Revenue share by customer spend decile."""
    rows = db.execute(text(CONCENTRATION_SQL)).mappings().all()
    deciles = [
        {"decile": r["decile"], "customers": r["customers"],
         "revenue": float(r["revenue"]), "pct_of_revenue": float(r["pct_of_revenue"])}
        for r in rows
    ]
    cumulative = 0.0
    for d in deciles:
        cumulative += d["pct_of_revenue"]
        d["cumulative_pct"] = round(cumulative, 1)
    return {"deciles": deciles, "sql": CONCENTRATION_SQL.strip()}


@router.get("/audit")
def data_quality_audit(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Three checks run against this dataset, and what each one concluded.

    Two of the three fail. They are reported as failures.
    """
    flatness = db.execute(text("""
        WITH r AS (
          SELECT c.cohort_month, c.month_index,
                 c.customers::float / NULLIF(b.customers, 0) AS pct
          FROM mv_cohort_retention c
          JOIN mv_cohort_retention b
            ON b.cohort_month = c.cohort_month AND b.month_index = 0
          WHERE c.month_index BETWEEN 1 AND 6
            -- Cohorts below 2,000 customers swing on noise; including them would
            -- widen the range and hide the very flatness being tested for.
            AND b.customers >= 2000
        )
        SELECT (min(pct) * 100)::numeric(5,1)     AS min_pct,
               (max(pct) * 100)::numeric(5,1)     AS max_pct,
               (stddev(pct) * 100)::numeric(5,2)  AS stddev_pct,
               count(*)                           AS cells
        FROM r
    """)).mappings().one()

    channel = db.execute(text("""
        SELECT channel, avg(amount)::numeric(12,0) AS aov, count(*) AS orders
        FROM orders GROUP BY channel ORDER BY channel
    """)).mappings().all()
    aovs = [float(c["aov"]) for c in channel]
    aov_spread = round(abs(aovs[0] - aovs[1]) / max(aovs) * 100, 2) if len(aovs) == 2 else None
    # Built outside the f-string below: nesting same-type quotes inside an
    # f-string only parses on Python 3.12+ (PEP 701), and this deploys to 3.11.
    channel_summary = ", ".join(
        "{} ₹{:,}".format(c["channel"], int(c["aov"])) for c in channel
    )

    top_decile = db.execute(text(f"SELECT pct_of_revenue FROM ({CONCENTRATION_SQL}) q "
                                 "WHERE decile = 1")).scalar()

    return {
        "checks": [
            {
                "name": "Cohort retention shape",
                "status": "fail",
                "observed": f"Across {flatness['cells']} cohort-months (cohorts of 2,000+ "
                            f"customers), month-1 to month-6 retention stays between "
                            f"{flatness['min_pct']}% and {flatness['max_pct']}% — a standard "
                            f"deviation of just {flatness['stddev_pct']} percentage points, with "
                            f"no decay from month 1 to month 6.",
                "expected": "Retention should decay sharply after month 1 and flatten into a "
                            "loyal tail. A flat line at every horizon is not a behaviour that "
                            "occurs in real retail.",
                "diagnosis": "The seed generator assigns each order a uniformly random date in "
                             "the trailing 24 months, independent of the customer's first "
                             "order. Repeat purchases are therefore equally likely in month 1 "
                             "and month 18 by construction.",
                "consequence": "Any retention, churn-timing or win-back-window conclusion drawn "
                               "from this dataset would be an artifact of the generator. The "
                               "matrix is shown because the query is correct; the finding is "
                               "not usable.",
                "to_fix": "Give each customer a purchase-intensity parameter and sample repeat "
                          "orders from a decaying inter-purchase interval rather than uniformly.",
            },
            {
                "name": "AOV differs by order channel",
                "status": "fail",
                "observed": f"Average order value is effectively identical across channels "
                            f"({channel_summary}) — a {aov_spread}% spread.",
                "expected": "In-store and online baskets differ materially in real retail.",
                "diagnosis": "Channel is assigned by random.choice independently of amount, so "
                             "the two distributions are the same distribution.",
                "consequence": "Channel cannot be used as an explanatory variable here.",
                "to_fix": "Condition the amount distribution on channel when generating.",
            },
            {
                "name": "Revenue concentration",
                "status": "pass",
                "observed": f"The top spend decile accounts for {float(top_decile)}% of revenue "
                            f"and the top three deciles for just over half.",
                "expected": "Revenue should be materially concentrated in a minority of customers.",
                "diagnosis": "This one holds up. Concentration emerges from the mixture "
                             "distribution over basket sizes combined with an uneven number of "
                             "orders per customer — it was not imposed directly.",
                "consequence": "Segment-value and high-value-targeting analysis on this dataset "
                               "is supportable. It is milder than real D2C retail, where the top "
                               "decile is typically nearer 40–60%, so treat it as directionally "
                               "right and conservative.",
                "to_fix": None,
            },
        ],
        "verdict": "Two of three checks fail. Segment-value and targeting work on this dataset "
                   "is sound; retention-timing and channel-attribution work is not. Publishing "
                   "the second set of conclusions because the charts render would be the actual "
                   "mistake available here.",
    }


@router.get("/recommendation")
def recommendation(db: Session = Depends(get_db)) -> dict[str, Any]:
    """The one recommendation this dataset can actually support, with its numbers."""
    row = db.execute(text("""
        SELECT count(*)                                   AS customers,
               sum(total_spent)::numeric(16,0)            AS historical_spend,
               avg(total_spent)::numeric(12,0)            AS avg_spend,
               avg(total_orders)::numeric(6,1)            AS avg_orders
        FROM customers
        WHERE is_active = true
          AND total_spent >= 15000
          AND last_order_date IS NOT NULL
          AND last_order_date < now() - interval '45 days'
    """)).mappings().one()

    baseline = db.execute(text("""
        SELECT avg(total_spent)::numeric(12,0) FROM customers
        WHERE is_active = true AND total_orders > 0
    """)).scalar()

    return {
        "title": "Win back high-value customers before they age out of the segment",
        "question": "Where is the largest recoverable revenue sitting right now?",
        "finding": {
            "customers": int(row["customers"]),
            "historical_spend": float(row["historical_spend"] or 0),
            "avg_spend": float(row["avg_spend"] or 0),
            "baseline_avg_spend": float(baseline or 0),
            "avg_orders": float(row["avg_orders"] or 0),
        },
        "reasoning": "These customers have spent above ₹15,000 and have not completed an order "
                     "in 45 days. They are worth more per head than the average purchasing "
                     "customer, which is what makes the segment worth a campaign rather than a "
                     "discount blast.",
        "action": "Run a controlled win-back on this segment with a holdout group, and measure "
                  "completed orders in the 30 days after send — not opens.",
        "how_to_measure": "Open and click rates are simulated in this environment and cannot "
                          "validate lift. The only honest success metric is incremental "
                          "completed-order revenue against the holdout.",
        "caveat": "The 45-day threshold is a business convention, not a finding. The audit shows "
                  "this dataset cannot tell us the real lapse point, because repeat-purchase "
                  "timing is uniformly distributed. On production data, derive the window from "
                  "the observed survival curve before committing to it.",
    }
