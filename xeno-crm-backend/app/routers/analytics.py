"""Evidence-backed analytics and safe query diagnostics for ThreadCo."""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.metrics import all_metrics
from app.models import Campaign, Communication, Customer, Order

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _plan_summary(plan: Any) -> dict[str, Any]:
    """Extract only the useful, non-sensitive fields from a PostgreSQL plan."""
    if isinstance(plan, str):
        plan = json.loads(plan)

    root = plan[0]["Plan"] if isinstance(plan, list) else plan["Plan"]
    nodes: list[str] = []
    indexes: list[str] = []

    def visit(node: dict[str, Any]) -> None:
        node_type = node.get("Node Type")
        if node_type:
            nodes.append(node_type)
        index_name = node.get("Index Name")
        if index_name:
            indexes.append(index_name)
        for child in node.get("Plans", []):
            visit(child)

    visit(root)
    return {
        "strategy": " → ".join(nodes),
        "indexes_used": indexes,
        "estimated_rows": root.get("Plan Rows"),
    }


def _audience_query_health(db: Session) -> dict[str, Any]:
    """Run one fixed, parameterized customer query and expose its real plan.

    This deliberately does not accept arbitrary SQL from the browser. It makes
    the query-performance reasoning visible without turning the public demo
    into a database console.
    """
    params = {"city": "Delhi", "min_spent": 10000, "limit": 100}
    statement = """
        SELECT id, name, city, total_spent, last_order_date
        FROM customers
        WHERE is_active = true
          AND city = :city
          AND total_spent >= :min_spent
        ORDER BY total_spent DESC
        LIMIT :limit
    """

    started = perf_counter()
    rows = db.execute(text(statement), params).fetchall()
    elapsed_ms = round((perf_counter() - started) * 1000, 2)

    result: dict[str, Any] = {
        "label": "High-value audience filter",
        "purpose": "Filter active Delhi customers by lifetime spend and sort the result set.",
        "parameters": {"city": params["city"], "min_spent": params["min_spent"]},
        "returned_rows": len(rows),
        "elapsed_ms": elapsed_ms,
        "parameterized": True,
        "plan_available": db.bind.dialect.name == "postgresql",
    }

    if result["plan_available"]:
        plan = db.execute(text(f"EXPLAIN (FORMAT JSON) {statement}"), params).scalar_one()
        result.update(_plan_summary(plan))
    else:
        result["strategy"] = "Plan inspection requires PostgreSQL."
        result["indexes_used"] = []

    return result


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db)):
    """Return real business metrics, data-quality checks, and query evidence."""
    now = datetime.now(timezone.utc)
    twelve_months_ago = now - timedelta(days=365)
    lapsed_cutoff = now - timedelta(days=45)

    # Served from mv_revenue_monthly rather than aggregating orders per request.
    # See the 'monthly-rollup' case study for the measured difference.
    monthly_rows = db.execute(text("""
        SELECT month, revenue, orders, buyers FROM mv_revenue_monthly
        WHERE month >= :cutoff ORDER BY month
    """), {"cutoff": twelve_months_ago}).mappings().all()
    revenue_by_month = [
        {
            "month": row["month"].strftime("%b %Y"),
            "revenue": round(float(row["revenue"] or 0), 2),
            "orders": int(row["orders"] or 0),
            "buyers": int(row["buyers"] or 0),
        }
        for row in monthly_rows
    ]

    # Served from mv_city_revenue: live aggregation over the full orders table
    # became a one-row-per-city read. Refreshed by scripts_refresh_rollups.py.
    city_rows = db.execute(text("""
        SELECT city, buyers AS customers, revenue
        FROM mv_city_revenue ORDER BY revenue DESC
    """)).mappings().all()
    city_performance = [
        {
            "city": row["city"] or "Unknown",
            "customers": int(row["customers"] or 0),
            "revenue": round(float(row["revenue"] or 0), 2),
        }
        for row in city_rows
    ]

    # Aggregated in SQL rather than by pulling every customer's tag array into
    # Python. The old version shipped one row per active customer across the wire
    # to produce four numbers. See the "app-side-aggregation" case study.
    lifecycle_distribution = [
        {"segment": row.tag, "customers": int(row.customers)}
        for row in db.execute(text("""
            SELECT unnest(tags) AS tag, count(*) AS customers
            FROM customers WHERE is_active = true
            GROUP BY 1 ORDER BY customers DESC
        """))
    ]

    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    completed_orders = db.query(func.count(Order.id)).filter(Order.status == "completed").scalar() or 0
    customers_without_orders = (
        db.query(func.count(Customer.id)).filter(Customer.total_orders == 0).scalar() or 0
    )
    active_campaigns = (
        db.query(func.count(Campaign.id)).filter(Campaign.status.in_(["draft", "sending", "running"])).scalar()
        or 0
    )
    communications = db.query(func.count(Communication.id)).scalar() or 0


    # Delivery and revenue figures come from app/metrics.py so that every screen
    # in the product uses one definition per metric. These used to be computed
    # inline here with a different definition from the dashboard's, which is how
    # three different revenue numbers ended up on three different pages.
    shared = all_metrics(db)
    metric_values = {k: m["value"] for k, m in shared["metrics"].items()}

    lapsed_high_value = (
        db.query(
            func.count(Customer.id).label("customers"),
            func.sum(Customer.total_spent).label("historical_spend"),
        )
        .filter(
            Customer.is_active == True,  # noqa: E712
            Customer.total_spent >= 10000,
            Customer.last_order_date.isnot(None),
            Customer.last_order_date <= lapsed_cutoff,
        )
        .one()
    )
    top_city = city_performance[0] if city_performance else None
    recommendations = [
        {
            "title": "Prioritize high-value win-back",
            "finding": (
                f"{int(lapsed_high_value.customers or 0):,} active customers have spent at least ₹10,000 "
                "but have not purchased in 45+ days."
            ),
            "action": "Create a controlled win-back segment and measure delivered, opened, clicked, and converted events separately.",
            "evidence": f"Historical spend of this audience: ₹{float(lapsed_high_value.historical_spend or 0):,.0f}.",
        },
        {
            "title": "Use city-level value, not customer count alone",
            "finding": (
                f"{top_city['city']} currently has the highest recorded customer spend "
                f"(₹{top_city['revenue']:,.0f} across {top_city['customers']:,} active customers)."
                if top_city
                else "No city-level customer data is available yet."
            ),
            "action": "Compare response and conversion by city before expanding a campaign nationally.",
            "evidence": "Calculated from completed-order customer aggregates; it is not a predicted revenue claim.",
        },
    ]

    return {
        "generated_at": now.isoformat(),
        "data_notice": "Development dataset seeded by ThreadCo. Campaign lifecycle outcomes are simulated and should not be interpreted as production lift.",
        "summary": {
            "customers": int(total_customers),
            "completed_orders": int(completed_orders),
            "active_campaigns": int(active_campaigns),
            "communications": int(communications),
        },
        "revenue_by_month": revenue_by_month,
        "city_performance": city_performance,
        "lifecycle_distribution": lifecycle_distribution,
        "data_quality": {
            "customers_without_completed_orders": int(customers_without_orders),
            "customer_email_uniqueness": "enforced by database constraint",
            "dataset_scope": "seeded development data",
        },
        "recommendations": recommendations,
        
        # Metric definitions travel with the values so the UI can show a reader
        # exactly what each number means.
        "metrics": shared["metrics"],
        "avg_open_rate": metric_values["open_rate"],
        "click_through": metric_values["click_rate"],
        "delivery_rate": metric_values["delivery_rate"],
        "conversion_rate": metric_values["conversion_rate"],
        "messages_sent": metric_values["messages_sent"],
        # Real per-channel funnel from the communications table. Replaces the
        # channel_wa / channel_email / channel_sms fields, which hardcoded three
        # channels and were removed along with revenue_per_msg.
        "channel_performance": shared["channel_performance"],
        "net_revenue": metric_values["net_revenue"],
        "gross_revenue": metric_values["gross_revenue"],
        "query_health": _audience_query_health(db),

    }
