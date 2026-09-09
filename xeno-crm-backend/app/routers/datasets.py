"""
Upload an order export, get an analysis of it.

The dataset id returned by /datasets is the only credential for that data.
It is an unguessable UUID, it is never listed, and the rows are deleted after
24 hours.
"""

from __future__ import annotations

import csv
import io
import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.dataset_analysis import (
    COHORT_SQL, RFM_SQL, cohort_matrix, quality_report, rfm_segments,
)
from app import voice_briefing
from app.dataset_ingest import (
    IngestError, MAX_BYTES, MAX_ROWS, expiry, new_dataset_id, parse_rows, sniff,
)

logger = logging.getLogger("xeno-crm.datasets")
router = APIRouter(prefix="/api/datasets", tags=["datasets"])


def ensure_tables(db: Session) -> None:
    """Create the upload tables if they are missing. Idempotent."""
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS uploaded_datasets (
            id            uuid PRIMARY KEY,
            created_at    timestamptz NOT NULL DEFAULT now(),
            expires_at    timestamptz NOT NULL,
            row_count     integer     NOT NULL DEFAULT 0,
            source_name   text,
            parse_report  jsonb
        )
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS uploaded_orders (
            dataset_id           uuid NOT NULL REFERENCES uploaded_datasets(id) ON DELETE CASCADE,
            row_no               integer NOT NULL,
            external_customer_id text NOT NULL,
            order_date           timestamptz NOT NULL,
            amount               double precision NOT NULL,
            status               text,
            PRIMARY KEY (dataset_id, row_no)
        )
    """))
    # Every analysis query filters on dataset_id first, then groups by customer
    # or orders by date; this composite matches both access paths.
    db.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_uploaded_orders_ds_customer_date
        ON uploaded_orders (dataset_id, external_customer_id, order_date)
    """))
    db.commit()


def purge_expired(db: Session) -> int:
    """Delete datasets past their retention window. Runs on every upload."""
    result = db.execute(text("DELETE FROM uploaded_datasets WHERE expires_at < now()"))
    db.commit()
    return result.rowcount or 0


def _load_dataset(db: Session, dataset_id: str) -> dict[str, Any]:
    row = db.execute(text("""
        SELECT id, row_count, source_name, parse_report, expires_at
        FROM uploaded_datasets WHERE id = :ds AND expires_at > now()
    """), {"ds": dataset_id}).mappings().first()
    if not row:
        raise HTTPException(
            status_code=404,
            detail="No such dataset, or it has expired. Uploads are deleted after 24 hours.",
        )
    return dict(row)


@router.post("/preview")
async def preview_upload(file: UploadFile = File(...)) -> dict[str, Any]:
    """Read headers and a sample, and guess the column mapping.

    Nothing is stored by this call. It exists so the user confirms the mapping
    before any data is written — real exports name these columns differently and
    a wrong guess would silently produce a wrong analysis.
    """
    raw = await file.read()
    try:
        result = sniff(raw, file.filename or "")
    except IngestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result["filename"] = file.filename
    return result


@router.post("")
async def create_dataset(
    file: UploadFile = File(...),
    customer_id: str = Form(...),
    order_date: str = Form(...),
    amount: str = Form(...),
    status: str | None = Form(None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Ingest the file under a confirmed mapping and return its dataset id."""
    ensure_tables(db)
    purged = purge_expired(db)

    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_BYTES // 1_048_576} MB.")

    mapping = {
        "customer_id": customer_id,
        "order_date": order_date,
        "amount": amount,
        "status": status or None,
    }

    try:
        rows, report = parse_rows(raw, mapping)
    except IngestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    dataset_id = new_dataset_id()
    db.execute(text("""
        INSERT INTO uploaded_datasets (id, expires_at, row_count, source_name, parse_report)
        VALUES (:id, :exp, :n, :name, CAST(:report AS jsonb))
    """), {
        "id": dataset_id, "exp": expiry(), "n": len(rows),
        "name": (file.filename or "upload.csv")[:200],
        "report": json.dumps(report),
    })

    # COPY, not INSERT. An executemany over ~8,000 rows to a remote database
    # spends its time on round trips and takes minutes; COPY streams the whole
    # batch in one statement and finishes in under a second. The uploaded values
    # are written into the COPY stream as data, never into SQL text.
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter="\t", quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
    for i, (customer, order_date, amount, row_status) in enumerate(rows):
        writer.writerow([
            dataset_id, i,
            # Tabs and newlines inside a value would corrupt the stream.
            customer.replace("\t", " ").replace("\n", " ").replace("\r", " "),
            order_date.isoformat(), amount,
            (row_status or "").replace("\t", " ").replace("\n", " ") or "\\N",
        ])
    buffer.seek(0)

    raw_conn = db.connection().connection
    with raw_conn.cursor() as cur:
        cur.copy_expert(
            "COPY uploaded_orders "
            "(dataset_id, row_no, external_customer_id, order_date, amount, status) "
            "FROM STDIN WITH (FORMAT text)",
            buffer,
        )
    db.commit()

    logger.info("Dataset %s ingested: %d rows (purged %d expired)",
                dataset_id, len(rows), purged)

    return {
        "dataset_id": dataset_id,
        "rows": len(rows),
        "parse_report": report,
        "expires_at": expiry().isoformat(),
        "note": "This id is the only way to reach your data. It is deleted after 24 hours.",
    }


@router.get("/{dataset_id}/analysis")
def analyse(dataset_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """RFM segments, cohort retention, and what this export can support."""
    meta = _load_dataset(db, dataset_id)
    report = meta.get("parse_report") or {}

    quality = quality_report(db, dataset_id, report)
    segments = rfm_segments(db, dataset_id)
    cohorts = cohort_matrix(db, dataset_id)

    total_revenue = sum(s["revenue"] for s in segments) or 1.0
    for s in segments:
        s["pct_of_revenue"] = round(s["revenue"] / total_revenue * 100, 1)

    # The single most actionable line: value sitting in lapsing segments.
    at_risk = [s for s in segments if s["segment"] in ("At Risk", "Cannot Lose Them", "Need Attention")]
    at_risk_customers = sum(s["customers"] for s in at_risk)
    at_risk_revenue = sum(s["revenue"] for s in at_risk)

    return {
        "dataset": {
            "id": dataset_id,
            "source_name": meta["source_name"],
            "rows": meta["row_count"],
            "expires_at": meta["expires_at"].isoformat() if meta["expires_at"] else None,
        },
        "quality": quality,
        "segments": segments,
        "cohorts": cohorts,
        "headline": {
            "at_risk_customers": at_risk_customers,
            "at_risk_revenue": round(at_risk_revenue, 2),
            "at_risk_pct_of_revenue": round(at_risk_revenue / total_revenue * 100, 1),
        },
        "sql": {
            "rfm": RFM_SQL.strip(),
            "cohort": COHORT_SQL.strip(),
        },
        "limits": {"max_rows": MAX_ROWS, "retention_hours": 24},
    }


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    """Delete an upload immediately, without waiting for expiry."""
    _load_dataset(db, dataset_id)
    db.execute(text("DELETE FROM uploaded_datasets WHERE id = :ds"), {"ds": dataset_id})
    db.commit()
    return {"status": "deleted", "dataset_id": dataset_id}


# ---------------------------------------------------------------------------
# Voice briefing
# ---------------------------------------------------------------------------

@router.get("/{dataset_id}/briefing")
def briefing_script(dataset_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """The spoken briefing as text, so it can be read as well as heard."""
    analysis = analyse(dataset_id, db)
    return {
        "script": voice_briefing.build_script(analysis),
        "audio_available": voice_briefing.available(),
    }


@router.get("/{dataset_id}/briefing.mp3")
async def briefing_audio(dataset_id: str, db: Session = Depends(get_db)):
    """Synthesise the briefing.

    The text comes from build_script() against this dataset's own analysis —
    there is deliberately no endpoint that speaks caller-supplied text, because
    synthesis is billed per character and that would be an open quota drain.
    """
    if not voice_briefing.available():
        raise HTTPException(
            status_code=503,
            detail="Voice briefing is not configured (ELEVENLABS_API_KEY unset).",
        )

    analysis = analyse(dataset_id, db)
    script = voice_briefing.build_script(analysis)

    try:
        audio = await voice_briefing.synthesise(script, dataset_id)
    except Exception as exc:
        logger.exception("Voice synthesis failed for %s", dataset_id)
        raise HTTPException(status_code=502, detail=f"Voice synthesis failed: {exc}") from exc

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )
