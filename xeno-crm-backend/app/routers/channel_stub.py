import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import ChannelStubLog, Order, Customer

import os

router = APIRouter(prefix="/channel", tags=["channel_stub"])
logger = logging.getLogger("xeno-crm.channel_stub")

PORT = os.environ.get("PORT", 8000)
WEBHOOK_URL = f"http://127.0.0.1:{PORT}/webhooks/receipt"

class SendMessageRequest(BaseModel):
    campaign_id: str
    customer_id: str
    message: str
    channel: str
    external_id: str
    recipient: str


webhook_semaphore = asyncio.Semaphore(10)

async def send_webhook_with_retry(payload: dict):
    """POST to webhook endpoint with exponential backoff (up to 3 retries)."""
    async with webhook_semaphore:
        async with httpx.AsyncClient() as client:
            for attempt in range(1, 4):
                try:
                    resp = await client.post(WEBHOOK_URL, json=payload, timeout=10.0)
                    if resp.is_success:
                        return
                    logger.warning(f"Webhook failed with status {resp.status_code}")
                except Exception as e:
                    logger.warning(f"Webhook exception: {e}")
                
                # Backoff: 2s, 4s, 8s
                await asyncio.sleep(2 ** attempt)
                
            logger.error(f"Failed to send webhook after 3 attempts: {payload}")


def check_and_log_idempotency(db: Session, campaign_id: str, customer_id: str, event_type: str) -> bool:
    """Disabled to prevent SQLite database locking under high concurrency."""
    return False


async def simulate_message_lifecycle(campaign_id: str, customer_id: str, external_id: str):
    """Simulate realistic delivery, open, click, and conversion events."""
    await asyncio.sleep(random.uniform(0.5, 2.0))
    
    try:
        async def emit_event(event_type: str, metadata: dict = None):
            payload = {
                "campaign_id": campaign_id,
                "customer_id": customer_id,
                "event_type": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": metadata or {}
            }
            if event_type == "failed":
                payload["metadata"]["reason"] = "simulated failure"
                
            await send_webhook_with_retry(payload)

        # 1. Delivered / Failed
        if random.random() < 0.10:  # 10% chance to fail
            await emit_event("failed")
            return
            
        await emit_event("delivered")
        
        # 2. Opened (70% of delivered)
        await asyncio.sleep(random.uniform(1.0, 5.0))
        if random.random() > 0.70:
            return
        await emit_event("opened")
        
        # 3. Read (60% of opened)
        await asyncio.sleep(random.uniform(0.5, 2.0))
        if random.random() > 0.60:
            return
        await emit_event("read")
        
        # 4. Clicked (20% of read)
        await asyncio.sleep(random.uniform(1.0, 5.0))
        if random.random() > 0.20:
            return
        await emit_event("clicked")
        
        # 5. Converted (5% of clicked)
        await asyncio.sleep(random.uniform(2.0, 10.0))
        if random.random() <= 0.05:
            order_val = round(random.uniform(500, 5000), 2)
            await emit_event("converted", metadata={"order_value": order_val, "reason": "campaign conversion"})

    except Exception as e:
        logger.error(f"Error in simulation task: {e}")


@router.post("/send", status_code=202)
async def send_message(req: SendMessageRequest, background_tasks: BackgroundTasks):
    """Accepts the message and simulates the lifecycle asynchronously."""
    background_tasks.add_task(
        simulate_message_lifecycle,
        req.campaign_id,
        req.customer_id,
        req.external_id
    )
    return {"status": "accepted"}
