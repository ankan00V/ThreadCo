"""
Customer routes — list, search, filter, and view customer data.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, Order
from app.schemas import CustomerResponse, OrderResponse

router = APIRouter(prefix="/api/customers", tags=["customers"])


# ── Stats (must be before /{customer_id} to avoid path conflict) ──────────

@router.get("/stats")
def customer_stats(db: Session = Depends(get_db)):
    """Aggregate customer and revenue statistics."""
    total_customers = db.query(Customer).count()

    total_revenue = db.query(func.sum(Customer.total_spent)).scalar() or 0.0
    total_orders = db.query(func.sum(Customer.total_orders)).scalar() or 0

    avg_order_value = round(total_revenue / total_orders, 2) if total_orders else 0.0

    # City breakdown
    city_rows = db.query(Customer.city, func.count()).group_by(Customer.city).all()
    city_breakdown = {city: count for city, count in city_rows if city}

    # Tag breakdown
    tag_counts = {}
    all_customers = db.query(Customer.tags).all()
    for (tags,) in all_customers:
        if tags:
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    # New this month (created_at within last 30 days)
    from datetime import datetime, timedelta, timezone
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_this_month = db.query(Customer).filter(Customer.created_at >= thirty_days_ago).count()

    return {
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "avg_order_value": avg_order_value,
        "city_breakdown": city_breakdown,
        "tag_breakdown": tag_counts,
        "new_this_month": new_this_month,
    }


# ── List / search customers ──────────────────────────────────────────────

@router.get("", response_model=List[CustomerResponse])
def list_customers(
    city: Optional[str] = None,
    gender: Optional[str] = None,
    tag: Optional[str] = None,
    min_spent: Optional[float] = None,
    max_spent: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List customers with optional filters."""
    query = db.query(Customer).filter(Customer.is_active == True)  # noqa: E712

    if city:
        query = query.filter(Customer.city == city)
    if gender:
        query = query.filter(Customer.gender == gender)
    if tag:
        query = query.filter(Customer.tags.any(tag))
    if min_spent is not None:
        query = query.filter(Customer.total_spent >= min_spent)
    if max_spent is not None:
        query = query.filter(Customer.total_spent <= max_spent)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Customer.name.ilike(pattern),
                Customer.email.ilike(pattern),
            )
        )

    query = query.order_by(Customer.total_spent.desc())
    return query.offset(offset).limit(limit).all()


# ── Single customer with recent orders ────────────────────────────────────

@router.get("/{customer_id}")
def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """Return a customer with their last 10 orders."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")

    recent_orders = (
        db.query(Order)
        .filter(Order.customer_id == customer.id)
        .order_by(Order.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "customer": CustomerResponse.model_validate(customer).model_dump(),
        "recent_orders": [OrderResponse.model_validate(o).model_dump() for o in recent_orders],
    }
