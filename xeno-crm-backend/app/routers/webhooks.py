import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Communication, Order, Customer, Campaign
from app.schemas import WebhookReceiptRequest
from sqlalchemy import func

logger = logging.getLogger("xeno-crm.webhooks")
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

STATUS_ORDER = {
    "queued": 0,
    "sent": 1,
    "delivered": 2,
    "failed": 2,
    "opened": 3,
    "read": 4,
    "clicked": 5,
    "converted": 6
}

@router.post("/receipt")
def receive_receipt(body: WebhookReceiptRequest, db: Session = Depends(get_db)):
    """Ingests callbacks from the channel stub."""
    
    # 1. Lookup or create Communication row
    comm = db.query(Communication).filter_by(
        campaign_id=body.campaign_id,
        customer_id=body.customer_id
    ).first()

    if not comm:
        # We might receive the webhook before the local dispatch loop finishes creating the row.
        # Create it safely.
        # We assume channel is tracked in campaign, so we might not have it here, but we can default.
        comm = Communication(
            id=uuid.uuid4(),
            campaign_id=body.campaign_id,
            customer_id=body.customer_id,
            channel="unknown", # this gets patched up if needed
            status="queued",
            events_json=[]
        )
        db.add(comm)

    # 2. Idempotency Check
    events = list(comm.events_json or [])
    if any(e.get("event_type") == body.event_type for e in events):
        return {"status": "ignored", "reason": "duplicate_event"}

    # 3. Append Event
    events.append({
        "event_type": body.event_type,
        "timestamp": body.timestamp.isoformat(),
        "metadata": body.metadata
    })
    # SQLAlchemy requires assigning a new list or using mutable JSON to trigger an update
    comm.events_json = events

    # 4. Update Status if it's a higher stage
    current_order = STATUS_ORDER.get(comm.status, 0)
    new_order = STATUS_ORDER.get(body.event_type, 0)
    
    # Special rule: once failed, it's terminal
    if comm.status != "failed" and new_order > current_order:
        comm.status = body.event_type
        if body.event_type in ["sent", "delivered"] and not comm.sent_at:
            comm.sent_at = body.timestamp

    # 4.5. If Converted, create Order
    if body.event_type == "converted":
        order_val = float(body.metadata.get("order_value", 0)) if body.metadata else 0.0
        if order_val > 0:
            customer = db.query(Customer).filter_by(id=body.customer_id).first()
            if customer:
                order_num = f"ORD-{uuid.uuid4().hex[:8].upper()}"
                order = Order(
                    id=uuid.uuid4(),
                    customer_id=customer.id,
                    order_number=order_num,
                    amount=order_val,
                    items=[{"name": "Campaign Product", "category": "Marketing", "quantity": 1, "price": order_val}],
                    channel="online",
                    status="completed",
                    city=customer.city,
                )
                db.add(order)
                customer.total_orders += 1
                customer.total_spent += order_val
                customer.last_order_date = datetime.now(timezone.utc)
                logger.info(f"Campaign conversion processed via webhook! {customer.name} ordered {order_num} for ₹{order_val}")

    # 5. Commit immediately
    db.commit()

    # 6. Check Completion
    campaign = db.query(Campaign).filter_by(id=body.campaign_id).first()
    if campaign and campaign.status in ["sending", "running"]:
        queued_count = db.query(func.count(Communication.id)).filter_by(
            campaign_id=body.campaign_id, 
            status="queued"
        ).scalar() or 0
        
        total_count = db.query(func.count(Communication.id)).filter_by(
            campaign_id=body.campaign_id
        ).scalar() or 0
        
        if queued_count == 0 and total_count == campaign.total_sent and campaign.total_sent > 0:
            campaign.status = "completed"
            campaign.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"Campaign {campaign.id} is now completed!")

    return {"status": "accepted"}
