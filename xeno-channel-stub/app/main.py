"""
Xeno Channel Stub — simulates messaging channel delivery.

This service receives send requests from the CRM, simulates message
delivery with realistic delays and outcomes, and calls back into
the CRM's receipt webhook with status updates.

Start:
    uvicorn app.main:app --reload --port 8001
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import SendRequest
from app.simulator import simulate_delivery, get_stats

load_dotenv()

logger = logging.getLogger("channel-stub")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

CRM_RECEIPT_URL = os.getenv("CRM_RECEIPT_URL", "http://localhost:8000/api/receipts")

# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Xeno Channel Stub",
    description="Simulated messaging channel service — WhatsApp, SMS, Email, RCS.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "xeno-channel-stub"}


@app.get("/stats")
def stats():
    return get_stats()


@app.post("/send")
async def send_message(request: SendRequest, background_tasks: BackgroundTasks):
    """
    Accept a send request from the CRM.

    Returns immediately with an acknowledgement. The actual delivery
    simulation runs asynchronously in the background.
    """
    logger.info(
        f"Channel stub received send request for {request.external_id} "
        f"via {request.channel}"
    )

    background_tasks.add_task(simulate_delivery, request, CRM_RECEIPT_URL)

    return {"accepted": True, "external_id": request.external_id}
