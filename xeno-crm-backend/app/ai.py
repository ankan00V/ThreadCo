"""
AI layer for Xeno CRM — powered by NVIDIA NIM (OpenAI-compatible).

Three capabilities:
  generate_segment  — NL query → structured filters + matching customers
  draft_message     — audience context → personalised campaign message
  recommend_channel — segment profile → best channel recommendation

Also exports apply_segment_filters() for reuse in campaign dispatch.
"""

import asyncio
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from openai import OpenAI
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Customer, Order

load_dotenv()

logger = logging.getLogger("xeno-crm.ai")

# ---------------------------------------------------------------------------
# NVIDIA NIM client (OpenAI-compatible)
# ---------------------------------------------------------------------------

_client = OpenAI(
    base_url=os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1"),
    api_key=os.getenv("NVIDIA_API_KEY", ""),
)
_model = os.getenv("NVIDIA_MODEL", "nvidia/llama-3.1-nemotron-ultra-253b-v1")


def _call_llm(system_prompt: str, user_message: str) -> str:
    """Synchronous LLM call — run via asyncio.to_thread from async context."""
    response = _client.chat.completions.create(
        model=_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.7,
        top_p=0.95,
        max_tokens=4096,
    )
    content = response.choices[0].message.content or ""
    return content.strip()


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM output, handling markdown code fences."""
    # Strip markdown code fences if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    cleaned = re.sub(r"```\s*$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    # Try parsing directly
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to find the first JSON object in the text
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise ValueError(f"Could not parse JSON from LLM response: {text[:200]}")


# ---------------------------------------------------------------------------
# Shared: apply segment filters to Customer table
# ---------------------------------------------------------------------------

def apply_segment_filters(filters: Dict[str, Any], db: Session) -> List[Customer]:
    """
    Apply structured filter rules to the Customer table.

    Accepts both AI-generated filter format and simpler pre-built formats.
    Returns list of matching Customer objects.
    """
    query = db.query(Customer).filter(Customer.is_active == True)  # noqa: E712
    now = datetime.now(timezone.utc)

    # --- Spending ---
    min_spent = filters.get("min_spent")
    if min_spent is not None:
        query = query.filter(Customer.total_spent >= float(min_spent))

    max_spent = filters.get("max_spent")
    if max_spent is not None:
        query = query.filter(Customer.total_spent <= float(max_spent))

    # --- Order count ---
    min_orders = filters.get("min_orders")
    if min_orders is not None:
        query = query.filter(Customer.total_orders >= int(min_orders))

    max_orders = filters.get("max_orders")
    if max_orders is not None:
        query = query.filter(Customer.total_orders <= int(max_orders))

    # --- Recency ---
    # days_since_last_order (simple format from pre-built segments)
    days_since = filters.get("days_since_last_order")
    if days_since is not None:
        cutoff = now - timedelta(days=int(days_since))
        query = query.filter(Customer.last_order_date != None)  # noqa: E711
        query = query.filter(Customer.last_order_date <= cutoff)

    # days_since_last_order_min → last order was AT LEAST this many days ago
    days_min = filters.get("days_since_last_order_min")
    if days_min is not None:
        cutoff = now - timedelta(days=int(days_min))
        query = query.filter(Customer.last_order_date != None)  # noqa: E711
        query = query.filter(Customer.last_order_date <= cutoff)

    # days_since_last_order_max → last order was AT MOST this many days ago
    days_max = filters.get("days_since_last_order_max")
    if days_max is not None:
        cutoff = now - timedelta(days=int(days_max))
        query = query.filter(Customer.last_order_date != None)  # noqa: E711
        query = query.filter(Customer.last_order_date >= cutoff)

    # --- Demographics ---
    cities = filters.get("cities")
    if cities and isinstance(cities, list) and len(cities) > 0:
        query = query.filter(Customer.city.in_(cities))

    gender = filters.get("gender")
    if gender:
        query = query.filter(Customer.gender == gender)

    min_age = filters.get("min_age")
    if min_age is not None:
        query = query.filter(Customer.age >= int(min_age))

    max_age = filters.get("max_age")
    if max_age is not None:
        query = query.filter(Customer.age <= int(max_age))

    # --- Tags (overlap — customer has ANY of the specified tags) ---
    tags = filters.get("tags")
    if tags and isinstance(tags, list) and len(tags) > 0:
        query = query.filter(Customer.tags.overlap(tags))

    return query.all()


def _customer_to_dict(c: Customer) -> dict:
    """Serialise a Customer ORM object to a plain dict."""
    return {
        "id": str(c.id),
        "name": c.name,
        "email": c.email,
        "phone": c.phone,
        "city": c.city,
        "total_spent": c.total_spent,
        "total_orders": c.total_orders,
        "last_order_date": c.last_order_date.isoformat() if c.last_order_date else None,
        "tags": c.tags or [],
    }


# ---------------------------------------------------------------------------
# 1. generate_segment
# ---------------------------------------------------------------------------

SEGMENT_SYSTEM_PROMPT = """You are a CRM segmentation engine for ThreadCo, a fashion brand in India.
You convert natural language audience descriptions into structured JSON filters.

Available customer fields:
- total_spent (float) — total money spent
- total_orders (int) — number of orders
- last_order_date (datetime) — last purchase date
- city (str) — one of: Mumbai, Delhi, Bangalore, Chennai, Hyderabad, Pune, Ludhiana, Jaipur
- gender (str) — "M" or "F"
- age (int) — 18 to 55
- tags (array) — can contain: vip, churned, loyal, new

You must respond with ONLY valid JSON, no explanation, no markdown. Format:
{
  "segment_name": "short descriptive name",
  "description": "one sentence describing this audience",
  "filters": {
    "min_spent": float or null,
    "max_spent": float or null,
    "min_orders": int or null,
    "max_orders": int or null,
    "days_since_last_order_min": int or null,
    "days_since_last_order_max": int or null,
    "cities": [list of cities] or null,
    "gender": "M" or "F" or null,
    "min_age": int or null,
    "max_age": int or null,
    "tags": [list of tags] or null
  }
}"""


async def generate_segment(query: str, db: Session) -> dict:
    """Convert a natural language query into a segment with matching customers."""

    # Gather DB context for the AI
    total_customers = db.query(Customer).count()
    city_rows = db.query(Customer.city, func.count()).group_by(Customer.city).all()
    city_dist = {city: count for city, count in city_rows if city}

    avg_spent = db.query(func.avg(Customer.total_spent)).scalar() or 0
    max_spent = db.query(func.max(Customer.total_spent)).scalar() or 0

    order_dates = db.query(func.min(Order.created_at), func.max(Order.created_at)).first()
    date_range = "unknown"
    if order_dates and order_dates[0] and order_dates[1]:
        date_range = f"{order_dates[0].strftime('%Y-%m-%d')} to {order_dates[1].strftime('%Y-%m-%d')}"

    context = (
        f"Database context:\n"
        f"- Total customers: {total_customers}\n"
        f"- Cities: {city_dist}\n"
        f"- Avg total_spent: ₹{avg_spent:,.0f}, Max: ₹{max_spent:,.0f}\n"
        f"- Available tags: vip, churned, loyal, new\n"
        f"- Order date range: {date_range}\n\n"
        f"Marketer's query: {query}"
    )

    # Call AI
    raw = await asyncio.to_thread(_call_llm, SEGMENT_SYSTEM_PROMPT, context)
    logger.info(f"AI segment response: {raw[:300]}")

    parsed = _extract_json(raw)
    filters = parsed.get("filters", {})

    # Apply filters
    matched = apply_segment_filters(filters, db)

    return {
        "segment_name": parsed.get("segment_name", "Untitled Segment"),
        "description": parsed.get("description", ""),
        "filters": filters,
        "matched_customers": [_customer_to_dict(c) for c in matched],
        "customer_count": len(matched),
    }


# ---------------------------------------------------------------------------
# 2. draft_message
# ---------------------------------------------------------------------------

MESSAGE_SYSTEM_PROMPT = """You are an expert marketing copywriter for a D2C CRM platform.

USER INTENT: {user_prompt}
SELECTED CHANNEL: {channel} (must be one of: whatsapp, sms, email, rcs)

CRITICAL RULES:
1. BRAND NAME: Analyze the USER INTENT carefully. If the user explicitly mentions a brand name, company name, or product name in their intent (e.g., "My brand is X", "We are Y"), you MUST use that name in the message (e.g. "The X Team"). Do NOT use "ThreadCo" if they named their own brand. Use "ThreadCo" ONLY as a fallback if NO brand is mentioned.
2. CHANNEL FORMAT:
   - EMAIL: Return a professional message with a compelling SUBJECT line (max 50 chars), formal greeting, body, and sign-off. Use full sentences.
   - WHATSAPP: Conversational, emoji-friendly, no subject line, short paragraphs, personal tone, clear CTA. Include 1-2 relevant emojis.
   - SMS: Ultra-concise, under 160 characters total if possible. Punchy, urgent, no formal signature. Use short link placeholders like [link].
   - RCS: Rich, engaging language that mentions visual/interactive elements. Slightly longer than SMS, conversational but polished.
3. PERSONALIZATION: Always use {{{{name}}}} for the recipient's first name.
4. TONE: Match the user's campaign goal (re-engagement = warm, sale = urgent, announcement = excited).

Return ONLY valid JSON in this exact structure:
{{
  "segment_description": "Human-readable description of the target audience",
  "filters": {{
    "cities": ["..."],
    "min_spend": 0,
    "days_since_last_order": 0,
    "gender": "M/F/null"
  }},
  "message": {{
    "subject": "string or null",
    "body": "The final message content"
  }},
  "channel_recommendation": "why this channel fits"
}}"""




async def draft_message(
    segment_name: str,
    segment_description: str,
    channel: str,
    campaign_goal: str,
    sample_customers: List[dict],
) -> dict:
    """Draft a personalised campaign message for a given audience and channel."""

    sample_info = "\n".join(
        f"  - {c.get('name', 'N/A')} from {c.get('city', 'N/A')}, tags: {c.get('tags', [])}"
        for c in sample_customers[:3]
    )

    formatted_prompt = MESSAGE_SYSTEM_PROMPT.format(
        user_prompt=campaign_goal,
        channel=channel
    )

    user_payload = (
        f"Audience: {segment_name} — {segment_description}\n"
        f"Sample customers:\n{sample_info}"
    )

    raw = await asyncio.to_thread(_call_llm, formatted_prompt, user_payload)
    logger.info(f"AI message response: {raw[:300]}")

    try:
        return _extract_json(raw)
    except (json.JSONDecodeError, ValueError):
        # Fallback if AI returns bad JSON
        return {
            "message": {
                "subject": "Something special for you" if channel == "email" else None,
                "body": f"Hey {{{{name}}}}, we've got something special for you at ThreadCo! Check it out 🛍️"
            },
            "channel_recommendation": f"{channel} is a good fit for this audience",
        }


# ---------------------------------------------------------------------------
# 3. recommend_channel
# ---------------------------------------------------------------------------

CHANNEL_SYSTEM_PROMPT = """You are a marketing channel strategist for ThreadCo, a fashion brand in India.
Given a segment description and sample customers, recommend the single best messaging channel.
Consider: age demographics, tags (vip prefers email, young prefers whatsapp), city tier.

Respond with ONLY one word — the channel name. No explanation.
Options: whatsapp, sms, email, rcs"""


async def recommend_channel(
    segment_description: str,
    sample_customers: List[dict],
) -> str:
    """Recommend the best messaging channel for a segment."""

    sample_info = "\n".join(
        f"  - {c.get('name', 'N/A')}, age {c.get('age', '?')}, {c.get('city', 'N/A')}, tags: {c.get('tags', [])}"
        for c in sample_customers[:5]
    )

    user_prompt = f"Segment: {segment_description}\nSample customers:\n{sample_info}"

    raw = await asyncio.to_thread(_call_llm, CHANNEL_SYSTEM_PROMPT, user_prompt)
    channel = raw.strip().lower().replace('"', "").replace("'", "")

    # Validate — fall back to whatsapp if AI returns something unexpected
    valid = {"whatsapp", "sms", "email", "rcs"}
    if channel not in valid:
        # Try to find a valid channel in the response
        for v in valid:
            if v in channel:
                return v
        logger.warning(f"AI returned unexpected channel '{channel}', defaulting to whatsapp")
        return "whatsapp"

    return channel
