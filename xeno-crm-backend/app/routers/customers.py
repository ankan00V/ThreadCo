"""
Customer routes — list, search, filter, and view customer data.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, Order
from app.schemas import CustomerResponse, OrderResponse

router = APIRouter(prefix="/api/customers", tags=["customers"])


# ── Stats (must be before /{customer_id} to avoid path conflict) ──────────

@router.get("/stats")
def customer_stats(db: Session = Depends(get_db)):
    """Aggregate customer and revenue statistics."""
    # Revenue and AOV come from the shared definitions rather than being
    # recomputed here off customer aggregates, which gave a third figure again.
    from app.metrics import all_metrics
    shared = all_metrics(db)
    values = {k: m["value"] for k, m in shared["metrics"].items()}

    total_customers = values["total_customers"]
    total_revenue = values["net_revenue"]
    avg_order_value = values["aov"]

    # City breakdown
    city_rows = db.query(Customer.city, func.count()).group_by(Customer.city).all()
    city_breakdown = {city: count for city, count in city_rows if city}

    # Tag breakdown, aggregated in SQL. The previous version pulled every
    # customer's tag array into Python, which is one row over the wire per
    # customer to produce four numbers.
    tag_counts = {
        row.tag: int(row.customers)
        for row in db.execute(text("""
            SELECT unnest(tags) AS tag, count(*) AS customers
            FROM customers GROUP BY 1
        """))
    }

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

def _apply_customer_filters(
    query,
    *,
    city: Optional[str],
    gender: Optional[str],
    tag: Optional[str],
    min_spent: Optional[float],
    max_spent: Optional[float],
    search: Optional[str],
):
    """Apply the directory's filters once for both list and paginated routes."""
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
        pattern = f"%{search.strip()}%"
        # Matches ix_customers_search_trgm, a pg_trgm GIN index on
        # (name || ' ' || email). Two separate ILIKE clauses OR'd together
        # cannot use it and sequentially scan the whole table instead.
        query = query.filter(
            func.concat(Customer.name, " ", Customer.email).ilike(pattern)
        )
    return query


@router.get("/directory")
def customer_directory(
    city: Optional[str] = None,
    gender: Optional[str] = None,
    tag: Optional[str] = None,
    min_spent: Optional[float] = None,
    max_spent: Optional[float] = None,
    search: Optional[str] = Query(None, max_length=100),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Server-side directory filtering and pagination for large customer sets."""
    base_query = _apply_customer_filters(
        db.query(Customer).filter(Customer.is_active == True),  # noqa: E712
        city=city,
        gender=gender,
        tag=tag,
        min_spent=min_spent,
        max_spent=max_spent,
        search=search,
    )
    total = base_query.order_by(None).count()
    items = (
        base_query
        .order_by(Customer.total_spent.desc(), Customer.id)
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "items": [CustomerResponse.model_validate(customer).model_dump() for customer in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }

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
    query = _apply_customer_filters(
        db.query(Customer).filter(Customer.is_active == True),  # noqa: E712
        city=city,
        gender=gender,
        tag=tag,
        min_spent=min_spent,
        max_spent=max_spent,
        search=search,
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
