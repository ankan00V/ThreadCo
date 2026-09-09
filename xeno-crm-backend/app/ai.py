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
_model = os.getenv("NVIDIA_MODEL", "nvidia/nemotron-3-super-120b-a12b")


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
        # The selected Nemotron model supports a thinking mode.  This service
        # consumes strict JSON, so reasoning must stay out of message.content.
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
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

def apply_segment_filters(
    filters: Dict[str, Any], db: Session, as_query: bool = False
):
    """
    Apply structured filter rules to the Customer table.

    Accepts both AI-generated filter format and simpler pre-built formats.

    Returns a list of Customer objects by default. Pass ``as_query=True`` to get
    the unexecuted Query back instead, so the caller can select just the columns
    it needs or apply its own limit — dispatch does this, because hydrating full
    ORM objects for every recipient is the dominant cost on a large segment.
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

    return query if as_query else query.all()


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

# Per-channel constraints are injected as a single block rather than listed as
# four alternatives. Giving the model all four sets of rules at once produced
# email-shaped copy on every channel — long, with a formal sign-off and a P.S.
# even when the target was a 160-character SMS.
CHANNEL_RULES = {
    "whatsapp": """CHANNEL: WhatsApp
- HARD LIMIT: 1024 characters. Aim for under 400.
- NO subject line. Set "subject" to null.
- 2-3 short sentences. Conversational, like a message from a person.
- At most 2 emoji, and only if they carry meaning.
- Do NOT write a call-to-action line like "Shop now" — WhatsApp renders that as
  a separate button, so putting it in the body duplicates it.
- Casual sign-off ("Team ThreadCo") or none at all. NEVER "Warm regards".
- NEVER include a P.S.""",

    "sms": """CHANNEL: SMS
- HARD LIMIT: 160 characters TOTAL, including the {{name}} placeholder. This is
  the single most important constraint. Count before you answer.
- NO subject line. Set "subject" to null.
- NO emoji, ever. Emoji force UCS-2 encoding and cut the limit from 160 to 70.
- NO greeting line and NO sign-off. There is no room for either.
- NO "Warm regards", NO "Team ThreadCo", NO P.S. These will not fit.
- Use [link] as the URL placeholder.
- ALL CAPS is acceptable for one or two key words (SALE, LAST CHANCE).
- Write it as one dense line. Urgency over warmth.""",

    "email": """CHANNEL: Email
- Subject line REQUIRED, 40-60 characters. Put it in "subject".
- Greeting on its own line: "Hi {{name}},"
- Body: 2-3 short paragraphs separated by blank lines.
- Do NOT write the CTA as a sentence — the template renders a button, so end the
  body before it.
- Professional sign-off ("Warm regards, Team ThreadCo").
- A P.S. line is allowed here, and only here.""",

    "rcs": """CHANNEL: RCS
- HARD LIMIT: 2000 characters. Aim for under 500.
- NO subject line. Set "subject" to null.
- The card renders an image above the text, so reference it naturally
  ("Swipe to see the new drop") without describing it in detail.
- Do NOT write CTA text — suggested-reply chips are rendered separately.
- Premium, polished tone. Emoji sparingly.
- Must still make sense as plain text, because handsets without RCS get the
  SMS fallback.
- NO formal sign-off, NO P.S.""",
}


MESSAGE_SYSTEM_PROMPT = """You are an expert marketing copywriter for a D2C CRM platform.

USER INTENT: {user_prompt}

{channel_rules}

The channel rules above are not suggestions. Copy written for the wrong channel
gets truncated by the carrier, billed as multiple segments, or rejected outright.
If the rules conflict with the user intent, follow the rules and compress the intent.

OTHER RULES:
1. BRAND NAME: If the USER INTENT names a brand, use that exact name. Otherwise use
   "ThreadCo". Do not invent a brand name.
2. PERSONALIZATION: Use {{{{name}}}} for the recipient's first name.
3. TONE: Match the campaign goal (re-engagement = warm, sale = urgent).
4. Before answering, count the characters in your body against the channel's hard
   limit. If it is over, rewrite it shorter.

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





# Prompt rules alone are not enough — the model drifts back to email shape, which
# is how a 160-character SMS ended up carrying "Warm regards, Team ThreadCo" and
# a P.S. This trims the output deterministically so the channel contract holds
# whatever the model returns.
# Anchored to a line start or sentence boundary on purpose. An unanchored
# "P\.?S\.?" matches the "Ps." inside "VIPs. Sale ends soon", which silently ate
# the rest of the message.
_EMAIL_ONLY_PATTERNS = [
    # A P.S. block: its own line, or after a sentence end, and the dots matter.
    r"(?:\n\s*|(?<=[.!?])\s+)P\.\s?S\.[:.\-]?\s.*$",
    # A sign-off: its own line, or after a sentence end.
    r"(?:\n\s*|(?<=[.!?])\s+)(warm regards|best regards|kind regards|sincerely|regards|cheers)\b\s*,?.*$",
]

_CHANNEL_BODY_LIMIT = {"sms": 160, "whatsapp": 1024, "rcs": 2000, "email": 5000}


def _enforce_channel_shape(parsed: dict, channel: str) -> dict:
    """Strip cross-channel artifacts and enforce the hard length budget."""
    message = parsed.get("message") or {}
    body = (message.get("body") or "").strip()

    if channel != "email":
        # No subject exists on these channels; carrying one confuses the UI.
        message["subject"] = None
        for pattern in _EMAIL_ONLY_PATTERNS:
            body = re.sub(pattern, "", body, flags=re.IGNORECASE | re.DOTALL).strip()

    if channel == "sms":
        # The GSM-7 alphabet SMS uses has no rupee sign, no curly quotes and no
        # emoji. Any one of them flips the whole message to UCS-2 and cuts the
        # per-segment budget from 160 to 70 characters, doubling the send cost.
        # Transliterate what has a sensible equivalent, drop the rest — dropping
        # the currency symbol outright would leave "over 1,00,000" reading wrong.
        for source, replacement in (
            ("\u20b9", "Rs."), ("\u2019", "'"), ("\u2018", "'"),
            ("\u201c", '"'), ("\u201d", '"'),
            ("\u2014", "-"), ("\u2013", "-"), ("\u2026", "..."),
        ):
            body = body.replace(source, replacement)
        body = body.encode("ascii", "ignore").decode("ascii")
        body = re.sub(r"[ \t]+", " ", body.replace("\n", " ")).strip()

    limit = _CHANNEL_BODY_LIMIT.get(channel, 1024)
    if len(body) > limit:
        # Cut on a sentence boundary where possible rather than mid-word.
        truncated = body[:limit]
        cut = max(truncated.rfind(". "), truncated.rfind("! "), truncated.rfind("? "))
        body = (truncated[: cut + 1] if cut > limit * 0.6 else truncated.rstrip()).strip()
        logger.warning("Trimmed %s body from over-limit output to %d chars", channel, len(body))

    message["body"] = body
    parsed["message"] = message
    return parsed


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

    channel_key = (channel or "whatsapp").lower()
    formatted_prompt = MESSAGE_SYSTEM_PROMPT.format(
        user_prompt=campaign_goal,
        channel_rules=CHANNEL_RULES.get(channel_key, CHANNEL_RULES["whatsapp"]),
    )

    user_payload = (
        f"Audience: {segment_name} — {segment_description}\n"
        f"Sample customers:\n{sample_info}"
    )

    # The model occasionally emits JSON with an unescaped quote or newline inside
    # the body string. One retry recovers it; dropping straight to the generic
    # fallback would quietly hand the marketer copy nobody wrote.
    parsed = None
    for attempt in range(2):
        raw = await asyncio.to_thread(_call_llm, formatted_prompt, user_payload)
        logger.info("AI message response (attempt %d): %s", attempt + 1, raw[:300])
        try:
            parsed = _extract_json(raw)
            break
        except (json.JSONDecodeError, ValueError):
            logger.warning("Unparseable LLM JSON on attempt %d", attempt + 1)

    try:
        if parsed is None:
            raise ValueError("no parseable response")
        return _enforce_channel_shape(parsed, channel_key)
    except (json.JSONDecodeError, ValueError, KeyError, TypeError):
        # Fallback if AI returns bad JSON
        fallback_bodies = {
            "sms": "Hi {{name}}, your ThreadCo reward is live. Shop now: [link]",
            "email": "Hi {{name}},\n\nWe have something new for you at ThreadCo.\n\nWarm regards,\nTeam ThreadCo",
            "rcs": "Hi {{name}}, the new ThreadCo drop just landed. Tap to browse.",
            "whatsapp": "Hi {{name}}, we've got something new for you at ThreadCo \ud83d\uded2",
        }
        return {
            "message": {
                "subject": "Something new for you" if channel_key == "email" else None,
                "body": fallback_bodies.get(channel_key, fallback_bodies["whatsapp"]),
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
