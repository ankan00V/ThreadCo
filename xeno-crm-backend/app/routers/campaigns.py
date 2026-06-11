import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Campaign, Communication, Customer, Segment
from app.schemas import CampaignResponse, CreateCampaignRequest, GenerateMessageRequest
from app.ai import apply_segment_filters, draft_message
import httpx

logger = logging.getLogger("xeno-crm.campaigns")
router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])

CHANNEL_STUB_URL = "http://127.0.0.1:8000/channel"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_recipient(customer: Customer, channel: str) -> str:
    """Pick the right contact field based on channel."""
    if channel == "email":
        return customer.email
    return customer.phone or customer.email


async def _send_to_channel(client: httpx.AsyncClient, payload: dict) -> dict:
    """POST a single message to the channel stub."""
    try:
        resp = await client.post(f"{CHANNEL_STUB_URL}/send", json=payload, timeout=5.0)
        return {"external_id": payload["external_id"], "success": resp.is_success}
    except Exception as e:
        logger.error(f"Failed to send {payload['external_id']}: {e}")
        return {"external_id": payload["external_id"], "success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

# ── Generate message ───────────────────────────────────────────────────────

@router.post("/generate-message")
async def generate_message(body: GenerateMessageRequest, db: Session = Depends(get_db)):
    """Generate a personalized AI message for a segment."""
    segment = db.query(Segment).filter(Segment.id == body.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
        
    customers = apply_segment_filters(segment.filter_logic or {}, db)
    # Take up to 5 sample customers to give the AI context
    sample_customers = [
        {
            "name": c.name,
            "city": c.city,
            "age": c.age,
            "tags": c.tags or []
        }
        for c in customers[:5]
    ]

    result = await draft_message(
        segment_name=segment.name,
        segment_description=segment.description or "",
        channel=body.channel,
        campaign_goal=body.campaign_goal,
        sample_customers=sample_customers
    )
    
    return result

# ── Create campaign ──────────────────────────────────────────────────────

@router.post("", response_model=CampaignResponse)
def create_campaign(body: CreateCampaignRequest, db: Session = Depends(get_db)):
    """Create a new campaign in draft status."""
    # Verify segment exists
    segment = db.query(Segment).filter(Segment.id == body.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    campaign = Campaign(
        id=uuid.uuid4(),
        name=body.name,
        segment_id=body.segment_id,
        channel=body.channel,
        message_template=body.message_template,
        status="draft",
    )
    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    logger.info(f"Campaign created: {campaign.id} ({campaign.name})")
    return campaign


# ── List campaigns ───────────────────────────────────────────────────────

@router.get("", response_model=List[CampaignResponse])
def list_campaigns(db: Session = Depends(get_db)):
    """Return all campaigns, newest first, with aggregate stats."""
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    results = []
    for c in campaigns:
        comms = db.query(Communication.status, func.count(Communication.id)).filter(
            Communication.campaign_id == c.id
        ).group_by(Communication.status).all()
        counts = {status: count for status, count in comms}
        
        sent = sum(counts.get(s, 0) for s in ["sent", "delivered", "failed", "opened", "read", "clicked", "converted"])
        delivered = sum(counts.get(s, 0) for s in ["delivered", "opened", "read", "clicked", "converted"])
        clicked = sum(counts.get(s, 0) for s in ["clicked", "converted"])
        
        resp = CampaignResponse.model_validate(c)
        resp.total_sent = resp.total_sent or sent
        resp.total_delivered = delivered
        resp.total_clicked = clicked
        results.append(resp)
    return results


# ── Global Dashboard Stats ──────────────────────────────────────────────────

@router.get("/dashboard/stats")
def get_global_dashboard_stats(db: Session = Depends(get_db)):
    """Returns global metrics for the entire CRM."""
    from app.models import Order

    total_customers = db.query(func.count(Customer.id)).scalar() or 0
    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    
    total_messages_sent = db.query(func.sum(Campaign.total_sent)).scalar() or 0
    
    total_engagements = db.query(func.count(Communication.id)).filter(
        Communication.status.in_(["clicked", "converted"])
    ).scalar() or 0
    
    revenue_generated = db.query(func.sum(Order.amount)).scalar() or 0.0
    avg_order_value = db.query(func.avg(Order.amount)).scalar() or 0.0

    return {
        "total_customers": total_customers,
        "total_campaigns": total_campaigns,
        "total_messages_sent": int(total_messages_sent),
        "total_engagements": total_engagements,
        "revenue_generated": float(revenue_generated),
        "avg_order_value": float(avg_order_value)
    }

# ── Campaign completion ──────────────────────────────────────────────────

@router.get("/{campaign_id}/check-completion")
def check_completion(campaign_id: str, db: Session = Depends(get_db)):
    """Fallback completion checker that runs on demand."""
    campaign = db.query(Campaign).filter_by(id=campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
        
    if campaign.status in ["sending", "running"]:
        queued_count = db.query(func.count(Communication.id)).filter_by(
            campaign_id=campaign.id, status="queued"
        ).scalar() or 0
        
        total_count = db.query(func.count(Communication.id)).filter_by(
            campaign_id=campaign.id
        ).scalar() or 0
        
        if queued_count == 0 and total_count == campaign.total_sent and campaign.total_sent > 0:
            campaign.status = "completed"
            campaign.completed_at = datetime.now(timezone.utc)
            db.commit()
            
    return {"status": campaign.status}

# ── Campaign detail ──────────────────────────────────────────────────────

@router.get("/{campaign_id}")
def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Return campaign details with all communications."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    comms = (
        db.query(Communication)
        .filter(Communication.campaign_id == campaign.id)
        .all()
    )

    return {
        "campaign": CampaignResponse.model_validate(campaign).model_dump(),
        "communications": [
            {
                "id": str(c.id),
                "customer_id": str(c.customer_id),
                "recipient": c.recipient,
                "channel": c.channel,
                "status": c.status,
                "message": c.message,
                "sent_at": c.sent_at.isoformat() if c.sent_at else None,
                "delivered_at": c.delivered_at.isoformat() if c.delivered_at else None,
                "opened_at": c.opened_at.isoformat() if c.opened_at else None,
                "clicked_at": c.clicked_at.isoformat() if c.clicked_at else None,
                "failed_reason": c.failed_reason,
            }
            for c in comms
        ],
    }


# ── Send campaign ────────────────────────────────────────────────────────

@router.post("/{campaign_id}/dispatch")
async def dispatch_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """
    Dispatch a campaign to all matching customers.

    1. Resolve segment filters → matching customers
    2. Create Communication records per customer
    3. POST each to the channel stub in parallel
    4. Return dispatch summary
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(status_code=400, detail=f"Campaign is '{campaign.status}', must be 'draft' to send")

    # Load segment and resolve matching customers
    segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    customers = apply_segment_filters(segment.filter_logic or {}, db)
    if not customers:
        raise HTTPException(status_code=400, detail="No customers match this segment's filters")

    now = datetime.now(timezone.utc)

    # Create Communication records
    communications = []
    payloads = []

    for customer in customers:
        # Personalise message
        message = campaign.message_template.replace("{{name}}", customer.name)
        recipient = _get_recipient(customer, campaign.channel)

        comm = Communication(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            customer_id=customer.id,
            recipient=recipient,
            channel=campaign.channel,
            status="queued",
            events_json=[],
        )
        communications.append(comm)
        db.add(comm)

        payloads.append({
            "external_id": str(comm.id),
            "recipient": recipient,
            "channel": campaign.channel,
            "message": message,
            "campaign_id": str(campaign.id),
            "customer_id": str(customer.id),
        })

    # Update campaign status
    campaign.status = "sending"
    campaign.sent_at = now
    campaign.total_sent = len(communications)

    db.commit()

    logger.info(f"Campaign {campaign.id}: dispatching to {len(payloads)} recipients")

    # Send all to channel stub in parallel but limit concurrency
    sem = asyncio.Semaphore(20)
    async def _sem_send(p):
        async with sem:
            return await _send_to_channel(client, p)

    async with httpx.AsyncClient() as client:
        tasks = [_sem_send(p) for p in payloads]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    success_count = sum(1 for r in results if isinstance(r, dict) and r.get("success"))
    logger.info(f"Campaign {campaign.id}: {success_count}/{len(payloads)} dispatched successfully")

    return {
        "campaign_id": str(campaign.id),
        "status": campaign.status,
        "total_sent": success_count,
        "message": f"Campaign dispatched to {success_count} recipients"
    }


# ── Campaign stats (Unified endpoint for frontend) ──────────────────────────

@router.get("/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str, db: Session = Depends(get_db)):
    """Unified endpoint for campaign details and performance stats."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Fetch communications joined with Customer
    results = db.query(Communication, Customer).join(Customer, Communication.customer_id == Customer.id).filter(
        Communication.campaign_id == campaign.id
    ).all()

    total_delivered = 0
    total_opened = 0
    total_clicked = 0
    total_converted = 0
    total_failed = 0

    communications_data = []

    for comm, customer in results:
        status = comm.status
        events = comm.events_json or []
        
        delivered_at = None
        opened_at = None
        clicked_at = None
        read_at = None
        failed_at = None

        for event in events:
            ev_type = event.get("event_type")
            ts = event.get("timestamp")
            if ev_type == "delivered" and not delivered_at:
                delivered_at = ts
            elif ev_type == "opened" and not opened_at:
                opened_at = ts
            elif ev_type == "clicked" and not clicked_at:
                clicked_at = ts
            elif ev_type == "read" and not read_at:
                read_at = ts
            elif ev_type == "failed" and not failed_at:
                failed_at = ts

        # Aggregate counts based on status inclusion
        if status in ["delivered", "opened", "read", "clicked", "converted"]:
            total_delivered += 1
        if status in ["opened", "read", "clicked", "converted"]:
            total_opened += 1
        if status in ["clicked", "converted"]:
            total_clicked += 1
        if status == "converted":
            total_converted += 1
        if status == "failed":
            total_failed += 1

        communications_data.append({
            "id": str(comm.id),
            "customer_name": customer.name,
            "recipient": comm.recipient or customer.email or customer.phone,
            "status": comm.status,
            "delivered_at": delivered_at,
            "clicked_at": clicked_at
        })

    total_sent = campaign.total_sent or len(results)

    delivery_rate = (total_delivered / total_sent * 100) if total_sent else 0.0
    open_rate = (total_opened / total_delivered * 100) if total_delivered else 0.0
    click_rate = (total_clicked / total_opened * 100) if total_opened else 0.0
    conversion_rate = (total_converted / total_clicked * 100) if total_clicked else 0.0

    # Attributes Revenue
    converted_customers = db.query(Communication.customer_id).filter(
        Communication.campaign_id == campaign.id,
        Communication.status == "converted"
    ).subquery()

    total_rev = db.query(func.sum(Order.amount)).filter(
        Order.customer_id.in_(converted_customers),
        Order.created_at >= campaign.created_at
    ).scalar() or 0.0

    return {
        "name": campaign.name,
        "status": campaign.status,
        "channel": campaign.channel,
        "sent_at": campaign.sent_at.isoformat() if campaign.sent_at else None,
        "total_sent": total_sent,
        "total_delivered": total_delivered,
        "total_opened": total_opened,
        "total_clicked": total_clicked,
        "converted": total_converted,
        "total_failed": total_failed,
        "delivery_rate": round(delivery_rate, 1),
        "open_rate": round(open_rate, 1),
        "click_rate": round(click_rate, 1),
        "conversion_rate": round(conversion_rate, 1),
        "total_revenue_attributed": float(total_rev),
        "communications": communications_data
    }

# ── Campaign performance ───────────────────────────────────────────────────

from app.models import Order

@router.get("/{campaign_id}/performance")
def campaign_performance(campaign_id: str, db: Session = Depends(get_db)):
    """Return campaign analytics computed from Communications."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    comms = db.query(Communication.status, func.count(Communication.id)).filter(
        Communication.campaign_id == campaign.id
    ).group_by(Communication.status).all()
    
    counts = {status: count for status, count in comms}
    
    sent = sum(counts.get(s, 0) for s in ["sent", "delivered", "failed", "opened", "read", "clicked", "converted"])
    failed = counts.get("failed", 0)
    delivered = sum(counts.get(s, 0) for s in ["delivered", "opened", "read", "clicked", "converted"])
    opened = sum(counts.get(s, 0) for s in ["opened", "read", "clicked", "converted"])
    read = sum(counts.get(s, 0) for s in ["read", "clicked", "converted"])
    clicked = sum(counts.get(s, 0) for s in ["clicked", "converted"])
    converted = counts.get("converted", 0)

    # Note: total_sent from campaign model vs actual dispatched counts
    total_recipients = campaign.total_sent or 0

    # Attributes Revenue:
    # Get all converted customers for this campaign
    converted_customers = db.query(Communication.customer_id).filter(
        Communication.campaign_id == campaign.id,
        Communication.status == "converted"
    ).subquery()

    # Sum their latest orders. 
    # For a real system we'd link Order to Campaign, but here we just sum all orders from those users created after campaign sent.
    total_rev = db.query(func.sum(Order.amount)).filter(
        Order.customer_id.in_(converted_customers),
        Order.created_at >= campaign.created_at
    ).scalar() or 0.0

    return {
        "campaign_id": str(campaign.id),
        "name": campaign.name,
        "status": campaign.status,
        "total_recipients": total_recipients,
        "sent": sent,
        "delivered": delivered,
        "failed": failed,
        "opened": opened,
        "read": read,
        "clicked": clicked,
        "converted": converted,
        "delivery_rate": round((delivered / sent) * 100, 1) if sent else 0,
        "open_rate": round((opened / delivered) * 100, 1) if delivered else 0,
        "click_rate": round((clicked / read) * 100, 1) if read else 0,
        "conversion_rate": round((converted / clicked) * 100, 1) if clicked else 0,
        "total_revenue_attributed": float(total_rev)
    }

@router.get("/{campaign_id}/communications")
def get_campaign_communications(campaign_id: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Paginated list of per-customer status for a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = db.query(Communication).filter(Communication.campaign_id == campaign.id).order_by(Communication.updated_at.desc())
    total = query.count()
    items = query.offset(offset).limit(limit).all()

    return {
        "items": items,
        "total": total,
        "page": (offset // limit) + 1 if limit else 1,
        "page_size": limit
    }

