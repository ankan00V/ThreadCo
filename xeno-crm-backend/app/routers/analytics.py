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

    monthly_rows = (
        db.query(
            func.date_trunc("month", Order.created_at).label("month"),
            func.sum(Order.amount).label("revenue"),
            func.count(Order.id).label("orders"),
            func.count(func.distinct(Order.customer_id)).label("buyers"),
        )
        .filter(Order.status == "completed", Order.created_at >= twelve_months_ago)
        .group_by("month")
        .order_by("month")
        .all()
    )
    revenue_by_month = [
        {
            "month": row.month.strftime("%b %Y"),
            "revenue": round(float(row.revenue or 0), 2),
            "orders": int(row.orders or 0),
            "buyers": int(row.buyers or 0),
        }
        for row in monthly_rows
    ]

    city_rows = (
        db.query(
            Customer.city.label("city"),
            func.count(Customer.id).label("customers"),
            func.sum(Customer.total_spent).label("revenue"),
        )
        .filter(Customer.is_active == True)  # noqa: E712
        .group_by(Customer.city)
        .order_by(func.sum(Customer.total_spent).desc())
        .all()
    )
    city_performance = [
        {
            "city": row.city or "Unknown",
            "customers": int(row.customers or 0),
            "revenue": round(float(row.revenue or 0), 2),
        }
        for row in city_rows
    ]

    tag_counts: dict[str, int] = {}
    for (tags,) in db.query(Customer.tags).filter(Customer.is_active == True).all():  # noqa: E712
        for tag in tags or []:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1
    lifecycle_distribution = [
        {"segment": tag, "customers": count}
        for tag, count in sorted(tag_counts.items(), key=lambda item: item[1], reverse=True)
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

    
    # --- Marketing Metrics ---
    campaign_stats = db.query(
        func.sum(Campaign.total_sent).label('total_sent'),
        func.sum(Campaign.total_opened).label('total_opened'),
        func.sum(Campaign.total_clicked).label('total_clicked')
    ).one()
    
    total_sent = campaign_stats.total_sent or 0
    total_opened = campaign_stats.total_opened or 0
    total_clicked = campaign_stats.total_clicked or 0
    
    avg_open_rate = (total_opened / total_sent * 100) if total_sent > 0 else 0
    click_through = (total_clicked / total_opened * 100) if total_opened > 0 else 0
    
    total_revenue = db.query(func.sum(Order.amount)).filter(Order.status == "completed").scalar() or 0
    revenue_per_msg = (total_revenue / total_sent) if total_sent > 0 else 0

    channel_stats = db.query(
        Campaign.channel,
        func.sum(Campaign.total_sent).label('sent')
    ).group_by(Campaign.channel).all()
    
    channel_counts = {row.channel: (row.sent or 0) for row in channel_stats}
    channel_wa = (channel_counts.get('whatsapp', 0) / total_sent * 100) if total_sent > 0 else 0
    channel_email = (channel_counts.get('email', 0) / total_sent * 100) if total_sent > 0 else 0
    channel_sms = (channel_counts.get('sms', 0) / total_sent * 100) if total_sent > 0 else 0
    # -------------------------

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
        
        "avg_open_rate": round(avg_open_rate, 1),
        "click_through": round(click_through, 1),
        "revenue_per_msg": round(revenue_per_msg, 2),
        "channel_wa": round(channel_wa, 1),
        "channel_email": round(channel_email, 1),
        "channel_sms": round(channel_sms, 1),
        "query_health": _audience_query_health(db),

    }
