import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from time import perf_counter
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Campaign, Communication, Customer, Segment
from app.schemas import CampaignResponse, CreateCampaignRequest, GenerateMessageRequest
from app.ai import AIUnavailable, apply_segment_filters, draft_message
import httpx

logger = logging.getLogger("xeno-crm.campaigns")
router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])

PORT = os.environ.get("PORT", 8000)
CHANNEL_STUB_URL = f"http://127.0.0.1:{PORT}/channel"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_recipient(customer: Customer, channel: str) -> str:
    """Pick the right contact field based on channel."""
    if channel == "email":
        return customer.email
    return customer.phone or customer.email


def _get_recipient_from_row(row: dict, channel: str) -> str:
    """Same rule as _get_recipient, for the lightweight dicts dispatch uses."""
    if channel == "email":
        return row["email"]
    return row["phone"] or row["email"]


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

@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Delete a campaign and its associated communications."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Delete associated communications to avoid foreign key constraints
    db.query(Communication).filter(Communication.campaign_id == campaign_id).delete()
    
    db.delete(campaign)
    db.commit()
    
    logger.info(f"Campaign deleted: {campaign_id}")
    return {"status": "success", "message": "Campaign deleted"}


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
    """Global CRM metrics, read from the shared definitions in app/metrics.py.

    This endpoint previously computed revenue as SUM(orders.amount) over every
    order, including returned and cancelled ones, while the analytics page used
    completed orders only. Both numbers were displayed at the same time, neither
    said which question it answered, and they differed by ~28%.
    """
    from app.metrics import all_metrics

    shared = all_metrics(db)
    values = {k: m["value"] for k, m in shared["metrics"].items()}

    total_campaigns = db.query(func.count(Campaign.id)).scalar() or 0
    total_engagements = db.query(func.count(Communication.id)).filter(
        Communication.status.in_(["clicked", "converted"])
    ).scalar() or 0

    return {
        "total_customers": values["total_customers"],
        "total_campaigns": total_campaigns,
        "total_messages_sent": values["messages_sent"],
        "total_engagements": total_engagements,
        "revenue_generated": values["net_revenue"],
        "avg_order_value": values["aov"],
        "open_rate": values["open_rate"],
        "click_rate": values["click_rate"],
        "delivery_rate": values["delivery_rate"],
        "channel_performance": shared["channel_performance"],
        # Definitions travel with the values so the UI can explain each number.
        "metrics": shared["metrics"],
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

    def communication_detail(comm: Communication) -> dict:
        """Serialize fields that actually exist in the durable event trail."""
        events = comm.events_json or []

        def event_timestamp(event_type: str):
            event = next((item for item in events if item.get("event_type") == event_type), None)
            return event.get("timestamp") if event else None

        failed_event = next((item for item in events if item.get("event_type") == "failed"), None)
        return {
            "id": str(comm.id),
            "customer_id": str(comm.customer_id),
            "recipient": comm.recipient,
            "channel": comm.channel,
            "status": comm.status,
            "events": events,
            "sent_at": comm.sent_at.isoformat() if comm.sent_at else None,
            "delivered_at": event_timestamp("delivered"),
            "opened_at": event_timestamp("opened"),
            "clicked_at": event_timestamp("clicked"),
            "failed_reason": (failed_event or {}).get("metadata", {}).get("reason"),
        }

    return {
        "campaign": CampaignResponse.model_validate(campaign).model_dump(),
        "communications": [communication_detail(comm) for comm in comms],
    }


# ── Send campaign ────────────────────────────────────────────────────────

# Recipients handled per chunk. Chosen so one chunk is a single bulk INSERT and
# a bounded burst of outbound requests, rather than one statement and one
# coroutine per recipient.
DISPATCH_CHUNK = 2_000

# Concurrent in-flight requests to the channel provider. Real providers rate-limit;
# unbounded fan-out is how you get throttled or blocked rather than fast.
DISPATCH_CONCURRENCY = 40

# Hard ceiling on a single dispatch. Each communication row costs roughly 1 KB
# with its event history, so an unbounded send against the largest segment would
# exhaust the free-tier database mid-campaign and leave it read-only. A real
# deployment raises or removes this; it is a resource guard, not a design limit.
MAX_RECIPIENTS_PER_DISPATCH = 5_000


def _resolve_recipient_rows(segment_filters: dict, db: Session, limit: int) -> list[dict]:
    """Resolve a segment to the columns dispatch actually needs.

    The previous version called apply_segment_filters(), which hydrates every
    matching row into a full ORM Customer object. At a few thousand customers
    that is invisible; against a large segment it is the single biggest cost in
    the request — most of it spent building objects to read three fields from.
    """
    query = apply_segment_filters(segment_filters or {}, db, as_query=True)
    rows = (
        query.with_entities(Customer.id, Customer.name, Customer.email, Customer.phone)
        .limit(limit)
        .all()
    )
    return [{"id": r[0], "name": r[1], "email": r[2], "phone": r[3]} for r in rows]


async def _deliver_chunk(client: httpx.AsyncClient, payloads: list[dict]) -> int:
    """Send one chunk with bounded concurrency; return the number accepted."""
    sem = asyncio.Semaphore(DISPATCH_CONCURRENCY)

    async def _send(payload):
        async with sem:
            return await _send_to_channel(client, payload)

    results = await asyncio.gather(*(_send(p) for p in payloads), return_exceptions=True)
    return sum(1 for r in results if isinstance(r, dict) and r.get("success"))


async def _run_dispatch(campaign_id: str, message_template: str, channel: str,
                        recipients: list[dict]) -> None:
    """Background worker: insert in bulk, deliver in chunks, update counters once.

    Runs outside the request so the HTTP call returns immediately. A campaign to
    a large segment takes longer than any sensible request timeout, and holding
    the connection open for it is what made the old endpoint fail at scale rather
    than merely be slow.
    """
    from app.database import SessionLocal

    delivered = 0
    db = SessionLocal()
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            for offset in range(0, len(recipients), DISPATCH_CHUNK):
                chunk = recipients[offset:offset + DISPATCH_CHUNK]

                rows, payloads = [], []
                for customer in chunk:
                    comm_id = uuid.uuid4()
                    recipient = _get_recipient_from_row(customer, channel)
                    rows.append({
                        "id": comm_id,
                        "campaign_id": uuid.UUID(campaign_id),
                        "customer_id": customer["id"],
                        "recipient": recipient,
                        "channel": channel,
                        "status": "queued",
                        "events_json": [],
                    })
                    payloads.append({
                        "external_id": str(comm_id),
                        "recipient": recipient,
                        "channel": channel,
                        "message": message_template.replace("{{name}}", customer["name"] or "there"),
                        "campaign_id": campaign_id,
                        "customer_id": str(customer["id"]),
                    })

                # One INSERT per chunk instead of one ORM add() per recipient.
                db.bulk_insert_mappings(Communication, rows)
                db.commit()

                delivered += await _deliver_chunk(client, payloads)
                logger.info("Campaign %s: %d/%d dispatched", campaign_id,
                            delivered, len(recipients))

        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "completed" if delivered else "failed"
            campaign.total_sent = delivered
            campaign.completed_at = datetime.now(timezone.utc)
            db.commit()
    except Exception:
        logger.exception("Campaign %s: dispatch failed", campaign_id)
        db.rollback()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "failed"
            db.commit()
    finally:
        db.close()


@router.post("/{campaign_id}/dispatch")
async def dispatch_campaign(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Queue a campaign for delivery and return immediately.

    The response confirms acceptance, not completion. Delivery progress is read
    from /api/campaigns/{id}/stats, which is computed from the communications
    event table rather than from a counter this endpoint sets optimistically.
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Campaign is '{campaign.status}', must be 'draft' to send",
        )

    segment = db.query(Segment).filter(Segment.id == campaign.segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    started = perf_counter()
    recipients = _resolve_recipient_rows(
        segment.filter_logic, db, MAX_RECIPIENTS_PER_DISPATCH
    )
    resolve_ms = round((perf_counter() - started) * 1000, 1)

    if not recipients:
        raise HTTPException(
            status_code=400, detail="No customers match this segment's filters"
        )

    capped = len(recipients) >= MAX_RECIPIENTS_PER_DISPATCH

    campaign.status = "sending"
    campaign.sent_at = datetime.now(timezone.utc)
    campaign.total_sent = 0
    db.commit()

    background_tasks.add_task(
        _run_dispatch,
        str(campaign.id),
        campaign.message_template,
        campaign.channel,
        recipients,
    )

    return {
        "campaign_id": str(campaign.id),
        "status": "sending",
        "queued_recipients": len(recipients),
        "segment_resolved_ms": resolve_ms,
        "capped": capped,
        "cap": MAX_RECIPIENTS_PER_DISPATCH if capped else None,
        "message": (
            f"Queued {len(recipients):,} recipients. Delivery runs in the background; "
            "poll /stats for progress."
            + (f" Capped at {MAX_RECIPIENTS_PER_DISPATCH:,} to protect the free-tier "
               "database — see MAX_RECIPIENTS_PER_DISPATCH." if capped else "")
        ),
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
