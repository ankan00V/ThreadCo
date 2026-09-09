"""
CSV ingestion for reviewer-supplied order exports.

The rest of this project analyses data it generated itself, which proves the
method works but answers nobody's actual question. This module accepts a real
order export — Shopify, WooCommerce, a spreadsheet — and runs the same analysis
against it.

Accepting arbitrary uploads on a public URL is the largest attack surface here,
so everything is bounded: file size, row count, column count, cell length, and
the lifetime of the stored data. Nothing from the file is ever used as an
identifier, a column name, or SQL — the only things that survive parsing are
four typed values per row.
"""

from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

MAX_BYTES = 8 * 1024 * 1024        # 8 MB
MAX_ROWS = 50_000
MAX_COLUMNS = 60
MAX_CELL_CHARS = 300
PREVIEW_ROWS = 5
RETENTION_HOURS = 24

# Header names seen in real exports, most specific first. Matching is on a
# normalised form so "Customer ID", "customer_id" and "CustomerId" all hit.
CANDIDATES = {
    "customer_id": [
        "customerid", "customeremail", "customer", "email", "buyeremail",
        "clientid", "userid", "billingemail", "contact",
    ],
    "order_date": [
        "orderdate", "createdat", "date", "paidat", "processedat", "purchasedate",
        "transactiondate", "timestamp", "orderdatetime",
    ],
    "amount": [
        "total", "totalprice", "amount", "ordertotal", "grandtotal", "revenue",
        "subtotal", "netamount", "value", "price",
    ],
    "status": [
        "status", "financialstatus", "orderstatus", "fulfillmentstatus", "state",
    ],
}

_NORMALISE = re.compile(r"[^a-z0-9]")


class IngestError(ValueError):
    """Raised for a file this module refuses to accept, with a readable reason."""


def _norm(header: str) -> str:
    return _NORMALISE.sub("", (header or "").lower())


def _looks_like_date(values: list[str]) -> bool:
    hits = sum(1 for v in values if v and _parse_date(v) is not None)
    return hits >= max(1, len(values) // 2)


def _looks_like_number(values: list[str]) -> bool:
    hits = sum(1 for v in values if v and _parse_amount(v) is not None)
    return hits >= max(1, len(values) // 2)


_DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y",
    "%d-%m-%Y", "%d %b %Y", "%b %d, %Y", "%Y/%m/%d",
)


def _parse_date(raw: str) -> datetime | None:
    value = (raw or "").strip()
    if not value:
        return None
    # Trim timezone suffixes and sub-second noise that strptime will not take.
    cleaned = re.sub(r"(\.\d+)?(Z|[+-]\d{2}:?\d{2})$", "", value).strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(cleaned[: len(fmt) + 6], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _parse_amount(raw: str) -> float | None:
    value = (raw or "").strip()
    if not value:
        return None
    # Strip currency symbols and thousands separators, keep sign and decimal.
    cleaned = re.sub(r"[^\d.\-]", "", value.replace(",", ""))
    if cleaned in ("", "-", "."):
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def sniff(raw: bytes, filename: str = "") -> dict[str, Any]:
    """Parse headers and a few rows, and guess which column is which.

    Returns the guess plus the evidence for it, so the user can correct it
    rather than trusting an invisible heuristic.
    """
    if len(raw) > MAX_BYTES:
        raise IngestError(
            f"File is {len(raw) / 1_048_576:.1f} MB; the limit is {MAX_BYTES // 1_048_576} MB."
        )

    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = raw.decode("latin-1")
        except Exception as exc:
            raise IngestError("Could not decode the file as UTF-8 or Latin-1.") from exc

    try:
        dialect = csv.Sniffer().sniff(text[:8192], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel

    reader = csv.reader(io.StringIO(text), dialect)
    try:
        headers = next(reader)
    except StopIteration as exc:
        raise IngestError("The file is empty.") from exc

    if len(headers) > MAX_COLUMNS:
        raise IngestError(f"{len(headers)} columns; the limit is {MAX_COLUMNS}.")
    if len(headers) < 2:
        raise IngestError(
            "Only one column was detected. Check the file is comma, semicolon or tab separated."
        )

    headers = [h.strip()[:MAX_CELL_CHARS] for h in headers]

    sample: list[list[str]] = []
    for row in reader:
        if len(sample) >= 40:
            break
        if row:
            sample.append([c[:MAX_CELL_CHARS] for c in row])

    if not sample:
        raise IngestError("The file has a header row but no data rows.")

    columns = {h: [r[i] if i < len(r) else "" for r in sample] for i, h in enumerate(headers)}

    # Guess by header name first, then confirm (or rescue) with the content.
    mapping: dict[str, str | None] = {}
    used: set[str] = set()

    for field, names in CANDIDATES.items():
        best = None
        for name in names:
            for h in headers:
                if h in used:
                    continue
                if _norm(h) == name:
                    best = h
                    break
            if best:
                break
        if not best:
            for name in names:
                for h in headers:
                    if h not in used and name in _norm(h):
                        best = h
                        break
                if best:
                    break
        if best:
            mapping[field] = best
            used.add(best)
        else:
            mapping[field] = None

    # Content-based rescue for the two fields we cannot proceed without.
    if not mapping["order_date"]:
        for h in headers:
            if h not in used and _looks_like_date(columns[h]):
                mapping["order_date"] = h
                used.add(h)
                break
    if not mapping["amount"]:
        for h in headers:
            if h not in used and _looks_like_number(columns[h]):
                mapping["amount"] = h
                used.add(h)
                break

    return {
        "headers": headers,
        "preview": [dict(zip(headers, r)) for r in sample[:PREVIEW_ROWS]],
        "detected": mapping,
        "required": ["customer_id", "order_date", "amount"],
        "optional": ["status"],
        "limits": {"max_rows": MAX_ROWS, "max_mb": MAX_BYTES // 1_048_576},
    }


def parse_rows(raw: bytes, mapping: dict[str, str]) -> tuple[list[tuple], dict[str, Any]]:
    """Apply a confirmed mapping and return typed rows plus a parse report.

    Rows that cannot be parsed are counted and reported rather than silently
    dropped — a silent drop is how an analysis ends up quietly wrong.
    """
    for field in ("customer_id", "order_date", "amount"):
        if not mapping.get(field):
            raise IngestError(f"No column mapped for '{field}'.")

    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    rows: list[tuple] = []
    skipped = {"missing_customer": 0, "bad_date": 0, "bad_amount": 0}
    seen_after_cap = 0

    for record in reader:
        if len(rows) >= MAX_ROWS:
            seen_after_cap += 1
            continue

        customer = (record.get(mapping["customer_id"]) or "").strip()[:MAX_CELL_CHARS]
        if not customer:
            skipped["missing_customer"] += 1
            continue

        order_date = _parse_date(record.get(mapping["order_date"]) or "")
        if order_date is None:
            skipped["bad_date"] += 1
            continue

        amount = _parse_amount(record.get(mapping["amount"]) or "")
        if amount is None:
            skipped["bad_amount"] += 1
            continue

        status = None
        if mapping.get("status"):
            status = ((record.get(mapping["status"]) or "").strip() or None)
            if status:
                status = status[:60]

        rows.append((customer, order_date, amount, status))

    if not rows:
        raise IngestError(
            "No usable rows. Check the date and amount columns are mapped correctly — "
            f"skipped: {skipped}."
        )

    return rows, {
        "accepted": len(rows),
        "skipped": skipped,
        "skipped_total": sum(skipped.values()),
        "truncated_rows": seen_after_cap,
    }


def new_dataset_id() -> str:
    """Unguessable id. It is the only credential for the uploaded data."""
    return str(uuid.uuid4())


def expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(hours=RETENTION_HOURS)
