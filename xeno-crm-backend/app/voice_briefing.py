"""
Spoken summary of an uploaded dataset's analysis.

The persona this whole upload flow is built for — a small brand owner with an
order export and no analyst — is exactly the person who will not read a
dashboard. A sixty-second briefing that says which customers are slipping away
and what it is worth is more likely to be acted on than a segment table.

Two constraints shape the design:

  * The synthesised text is ALWAYS generated here from the analysis. There is no
    endpoint that speaks caller-supplied text — that would be an open invitation
    to burn the account's character quota, and ElevenLabs bills per character.
  * Audio is cached per dataset. The analysis for a dataset does not change, so
    a second listen costs nothing.
"""

from __future__ import annotations

import hashlib
import logging
import os
from typing import Any

import httpx

logger = logging.getLogger("xeno-crm.voice")

API_URL = "https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL"      # Sarah — measured, reads numbers clearly
MODEL = "eleven_turbo_v2_5"

# A briefing is a fixed shape, so this is a ceiling on our own template, not a
# user-facing limit. It exists so a malformed analysis cannot produce a huge bill.
MAX_CHARS = 1_400

_cache: dict[str, bytes] = {}
_CACHE_LIMIT = 32


def available() -> bool:
    return bool(os.getenv("ELEVENLABS_API_KEY"))


def _inr(value: float) -> str:
    """Spoken form. '₹58,87,006' reads badly; 'about 59 lakh rupees' does not."""
    v = abs(float(value or 0))
    if v >= 10_000_000:
        return f"about {v / 10_000_000:.1f} crore rupees"
    if v >= 100_000:
        return f"about {v / 100_000:.1f} lakh rupees"
    if v >= 1_000:
        return f"about {v / 1000:.0f} thousand rupees"
    return f"{v:.0f} rupees"


def build_script(analysis: dict[str, Any]) -> str:
    """Compose the briefing from the analysis. Server-side, always."""
    summary = analysis["quality"]["summary"]
    headline = analysis["headline"]
    segments = analysis.get("segments") or []

    by_name = {s["segment"]: s for s in segments}
    champions = by_name.get("Champions")
    top = segments[0] if segments else None

    parts: list[str] = []

    parts.append(
        f"Here is what your export shows. "
        f"{summary['orders']:,} orders from {summary['customers']:,} customers, "
        f"worth {_inr(summary['revenue'])} over {summary['span_days']} days."
    )

    if champions and champions["customers"]:
        parts.append(
            f"Your Champions segment is {champions['customers']:,} customers, "
            f"and it accounts for {champions['pct_of_revenue']} percent of revenue. "
            f"That concentration is normal, and it is why losing a few of them hurts."
        )
    elif top:
        parts.append(
            f"Your largest segment by revenue is {top['segment']}, "
            f"at {top['pct_of_revenue']} percent of the total."
        )

    if headline["at_risk_customers"]:
        parts.append(
            f"The number to act on is this. "
            f"{headline['at_risk_customers']:,} customers are showing lapse signals — "
            f"they used to buy and have gone quiet. "
            f"Between them they represent {_inr(headline['at_risk_revenue'])}, "
            f"or {headline['at_risk_pct_of_revenue']} percent of your revenue. "
            f"Win-back effort earns more here than anywhere else on this list."
        )

    warnings = [c for c in analysis["quality"]["checks"] if c["status"] != "pass"]
    if warnings:
        parts.append(
            f"One caveat before you act. {warnings[0]['consequence']}"
        )
    else:
        parts.append(
            "All four data quality checks passed, so these segments are safe to act on."
        )

    script = " ".join(parts)
    return script[:MAX_CHARS]


async def synthesise(script: str, dataset_id: str) -> bytes:
    """Return MP3 bytes for the script, cached per dataset."""
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured.")

    voice = os.getenv("ELEVENLABS_VOICE_ID") or DEFAULT_VOICE
    fingerprint = hashlib.sha256(f"{dataset_id}:{voice}:{script}".encode()).hexdigest()

    if fingerprint in _cache:
        logger.info("Voice briefing cache hit for %s", dataset_id)
        return _cache[fingerprint]

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            API_URL.format(voice_id=voice),
            headers={"xi-api-key": key, "accept": "audio/mpeg"},
            json={
                "text": script,
                "model_id": MODEL,
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.75},
            },
        )
    if response.status_code != 200:
        raise RuntimeError(
            f"ElevenLabs returned {response.status_code}: {response.text[:200]}"
        )

    audio = response.content
    if len(_cache) >= _CACHE_LIMIT:
        _cache.pop(next(iter(_cache)))
    _cache[fingerprint] = audio
    return audio


def build_project_script(audit: dict, recommendation: dict, dataset: dict) -> str:
    """Briefing for the built-in dataset, spoken on the Analysis page.

    Separate from build_script() because it tells a different story: not "here is
    your data" but "here is what these checks caught, and what changed". It is
    reachable without uploading anything, which is the point — the voice work
    should not be hidden behind a file picker.
    """
    passing = audit.get("passing", 0)
    total = audit.get("total", 0)
    provenance = audit.get("provenance") or {}
    finding = recommendation.get("finding") or {}

    parts: list[str] = []

    parts.append(
        f"This is the analysis briefing for the built-in dataset — "
        f"{dataset.get('orders', 0):,} orders from {dataset.get('customers', 0):,} customers "
        f"on live Postgres."
    )

    parts.append(
        f"Three data quality checks run against it, and {passing} of {total} pass today."
    )

    if provenance:
        parts.append(
            "That is not the interesting part. Two of them failed on the first version of this "
            "dataset. Retention sat flat in every cohort month, which is not a behaviour real "
            "customers show — it was the signature of a generator assigning order dates at random. "
            "A churn model built on that data scored point five zero two, which is chance, and "
            "confirmed it independently. The generator was rewritten to model actual purchase "
            "behaviour, and the same model now scores point nine four four, with recency the "
            "strongest feature, exactly as RFM theory predicts."
        )

    if finding.get("customers"):
        window = (recommendation.get("lapse_window") or {}).get("days")
        # The window is derived from purchase gaps, so speak the derived number
        # rather than a hard-coded one that would drift from the page.
        when = (f"{window} days — the point by which nine in ten returning customers have "
                f"already come back" if window else "the lapse window")
        parts.append(
            f"On the current data, the segment worth acting on is "
            f"{int(finding['customers']):,} high value customers who have not ordered in "
            f"{when}. Between them they hold {_inr(finding.get('historical_spend', 0))} "
            f"of historical spend."
        )

    parts.append(
        "The caveat worth keeping: this dataset is generated, so it proves the method rather than "
        "the market. Upload your own export on the Your Data page to run the same analysis on real "
        "numbers."
    )

    return " ".join(parts)[:MAX_CHARS]
