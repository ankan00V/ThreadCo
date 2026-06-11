"""
Segment routes — AI-powered audience generation, listing, and detail.
"""

import asyncio
import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Segment
from app.schemas import NLSegmentRequest, SegmentResponse
from app.ai import generate_segment, draft_message, recommend_channel, apply_segment_filters

logger = logging.getLogger("xeno-crm.segments")
router = APIRouter(prefix="/api/segments", tags=["segments"])


# ── AI-powered segment generation ────────────────────────────────────────

@router.post("/generate")
async def generate(body: NLSegmentRequest, db: Session = Depends(get_db)):
    """
    Convert a natural language query into a structured segment.

    Calls three AI functions in parallel:
      1. generate_segment — NL → filters + matched customers
      2. draft_message    — audience context → campaign message
      3. recommend_channel — segment profile → best channel

    Optionally saves the segment to the database.
    """
    logger.info(f"Generating segment for query: '{body.query}'")

    # Step 1: Generate segment (must happen first — we need the results for steps 2 & 3)
    segment_result = await generate_segment(body.query, db)

    matched = segment_result["matched_customers"]
    sample = matched[:5]

    # Step 2 & 3: Draft message + recommend channel in parallel
    message_task = draft_message(
        segment_name=segment_result["segment_name"],
        segment_description=segment_result["description"],
        channel=body.channel,
        campaign_goal=body.campaign_goal or "engage this audience",
        sample_customers=sample,
    )
    channel_task = recommend_channel(
        segment_description=segment_result["description"],
        sample_customers=sample,
    )

    suggested_msg, rec_channel = await asyncio.gather(message_task, channel_task)

    # Optionally save to DB
    saved = False
    segment_id = None

    if body.save:
        seg = Segment(
            id=uuid.uuid4(),
            name=segment_result["segment_name"],
            description=segment_result["description"],
            filter_logic=segment_result["filters"],
            natural_language_query=body.query,
            customer_count=segment_result["customer_count"],
            created_by="ai",
        )
        db.add(seg)
        db.commit()
        db.refresh(seg)
        saved = True
        segment_id = str(seg.id)
        logger.info(f"Segment saved: {seg.id} ({seg.name})")

    return {
        "segment": {
            "name": segment_result["segment_name"],
            "description": segment_result["description"],
            "filters": segment_result["filters"],
            "customer_count": segment_result["customer_count"],
        },
        "matched_customers": matched,
        "suggested_message": suggested_msg,
        "recommended_channel": rec_channel,
        "saved": saved,
        "segment_id": segment_id,
    }


# ── List all saved segments ──────────────────────────────────────────────

@router.get("", response_model=List[SegmentResponse])
def list_segments(db: Session = Depends(get_db)):
    """Return all saved segments, newest first."""
    return db.query(Segment).order_by(Segment.created_at.desc()).all()


# ── Single segment with recomputed count ─────────────────────────────────

@router.get("/{segment_id}")
def get_segment(segment_id: str, db: Session = Depends(get_db)):
    """Return a segment and recompute its current customer count."""
    segment = db.query(Segment).filter(Segment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")

    # Recompute from current DB state
    matched = apply_segment_filters(segment.filter_logic or {}, db)
    segment.customer_count = len(matched)
    db.commit()

    return SegmentResponse.model_validate(segment).model_dump()
