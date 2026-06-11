"""
Delivery lifecycle simulator for the channel stub.

Models the realistic lifecycle of a message:
  queued → sent → delivered (or failed) → opened → clicked

Each stage has randomised delays and probabilistic outcomes.
At every stage transition, a receipt is POSTed back to the CRM via
the retry module.

In-memory counters are exposed for the /stats endpoint.
"""

import asyncio
import logging
import random
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

from app.retry import post_with_retry
from app.schemas import SendRequest, ReceiptPayload

logger = logging.getLogger("channel-stub.simulator")

# ---------------------------------------------------------------------------
# In-memory stats counters (thread-safe, reset on restart)
# ---------------------------------------------------------------------------

_lock = Lock()
_stats = {
    "total_received": 0,
    "total_sent": 0,
    "total_delivered": 0,
    "total_failed": 0,
    "total_opened": 0,
    "total_clicked": 0,
}


def get_stats() -> dict:
    """Return a snapshot of the current counters."""
    with _lock:
        return dict(_stats)


def _increment(key: str):
    with _lock:
        _stats[key] += 1


# ---------------------------------------------------------------------------
# Channel-specific open rates
# ---------------------------------------------------------------------------

OPEN_RATES = {
    "whatsapp": 0.65,
    "sms": 0.45,
    "email": 0.38,
    "rcs": 0.60,
}

FAIL_REASONS = ["invalid_number", "opted_out", "carrier_error"]


# ---------------------------------------------------------------------------
# Receipt helper
# ---------------------------------------------------------------------------

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _post_receipt(receipt_url: str, external_id: str, status: str, metadata: Optional[dict] = None):
    """Build a ReceiptPayload and POST it to the CRM."""
    payload = ReceiptPayload(
        external_id=external_id,
        status=status,
        timestamp=_now_iso(),
        metadata=metadata or {},
    )
    await post_with_retry(receipt_url, payload.model_dump())


# ---------------------------------------------------------------------------
# Main simulation coroutine
# ---------------------------------------------------------------------------

async def simulate_delivery(request: SendRequest, receipt_url: str):
    """
    Run the full delivery lifecycle for one message.

    This coroutine runs in the background — it never blocks the /send response.
    """
    eid = request.external_id
    channel = request.channel.lower()

    _increment("total_received")
    logger.info(f"[{eid}] Starting delivery simulation via {channel}")

    # ------------------------------------------------------------------
    # STAGE 1 — sent (always happens)
    # ------------------------------------------------------------------
    await asyncio.sleep(random.uniform(1.0, 3.0))
    _increment("total_sent")
    await _post_receipt(receipt_url, eid, "sent")
    logger.info(f"[{eid}] → sent")

    # ------------------------------------------------------------------
    # STAGE 2 — delivered or failed
    # ------------------------------------------------------------------
    if random.random() < 0.10:
        # 10% failure
        await asyncio.sleep(random.uniform(1.0, 2.0))
        reason = random.choice(FAIL_REASONS)
        _increment("total_failed")
        await _post_receipt(receipt_url, eid, "failed", {"reason": reason})
        logger.info(f"[{eid}] → failed ({reason})")
        return  # lifecycle ends here

    # 90% delivered
    await asyncio.sleep(random.uniform(2.0, 5.0))
    _increment("total_delivered")
    await _post_receipt(receipt_url, eid, "delivered")
    logger.info(f"[{eid}] → delivered")

    # ------------------------------------------------------------------
    # STAGE 3 — opened (channel-dependent open rate)
    # ------------------------------------------------------------------
    open_rate = OPEN_RATES.get(channel, 0.55)
    if random.random() >= open_rate:
        logger.info(f"[{eid}] → not opened (lifecycle ends)")
        return

    await asyncio.sleep(random.uniform(5.0, 15.0))
    _increment("total_opened")
    await _post_receipt(receipt_url, eid, "opened")
    logger.info(f"[{eid}] → opened")

    # ------------------------------------------------------------------
    # STAGE 4 — clicked (30% of opened)
    # ------------------------------------------------------------------
    if random.random() >= 0.30:
        logger.info(f"[{eid}] → not clicked (lifecycle ends)")
        return

    await asyncio.sleep(random.uniform(3.0, 8.0))
    _increment("total_clicked")
    await _post_receipt(receipt_url, eid, "clicked")
    logger.info(f"[{eid}] → clicked")

    logger.info(f"[{eid}] Lifecycle complete.")
