"""
HTTP POST with exponential backoff retry.

Used by the simulator to deliver receipt callbacks to the CRM.
If all retries fail, the failure is logged but never crashes the caller.
"""

import logging

import httpx

logger = logging.getLogger("channel-stub.retry")


async def post_with_retry(
    url: str,
    payload: dict,
    max_retries: int = 3,
) -> bool:
    """
    POST JSON to `url` with exponential backoff.

    Retry schedule: 2s, 4s, 8s (2^attempt seconds).
    Each attempt has a 10-second timeout.

    Returns True on success (2xx), False if all retries exhausted.
    """
    import asyncio

    external_id = payload.get("external_id", "unknown")

    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload)

            if response.is_success:
                logger.info(
                    f"Receipt delivered: {external_id} → {payload.get('status')} "
                    f"(attempt {attempt + 1})"
                )
                return True

            logger.warning(
                f"Receipt POST got {response.status_code} for {external_id} "
                f"(attempt {attempt + 1}/{max_retries})"
            )

        except Exception as e:
            logger.warning(
                f"Receipt POST failed for {external_id} "
                f"(attempt {attempt + 1}/{max_retries}): {e}"
            )

        # Exponential backoff: 2^0=1 → but we use 2^(attempt+1) = 2, 4, 8
        if attempt < max_retries - 1:
            wait = 2 ** (attempt + 1)
            logger.info(f"Retrying {external_id} in {wait}s...")
            await asyncio.sleep(wait)

    logger.error(f"Receipt delivery failed after {max_retries} retries: {external_id}")
    return False
