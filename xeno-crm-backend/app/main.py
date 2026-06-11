"""
Xeno CRM API — main application entry point.

Start the server:
    uvicorn app.main:app --reload --port 8000
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database import engine, Base, get_db

# Import models so Base.metadata knows about all tables
from app import models  # noqa: F401

# Import routers
from app.routers import customers, segments, campaigns, webhooks, channel_stub

logger = logging.getLogger("uvicorn.error")


# ---------------------------------------------------------------------------
# Lifespan — create tables on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully.")
        
        # Verify DB connection and auto-seed if empty
        from app.database import SessionLocal
        from app.models import Customer
        from app.seed import seed
        
        db = SessionLocal()
        try:
            # Simple query to check connection
            db.execute(text("SELECT 1"))
            # Check if seeding is needed
            if db.query(Customer).count() == 0:
                logger.info("Customers table is empty. Auto-running seed data...")
                seed()
        finally:
            db.close()
            
    except Exception as e:
        logger.warning(f"Could not create tables (database may not be configured yet): {e}")
    yield


# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Xeno CRM API",
    description="AI-native Mini CRM for reaching shoppers — built for ThreadCo.",
    version="0.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — open for development, tighten before production
# ---------------------------------------------------------------------------
origins = [
    "http://localhost:5173", 
    "http://localhost:5174", 
    "http://localhost:3000",
    "https://thread-co-beige.vercel.app"
]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Register routers
# ---------------------------------------------------------------------------
app.include_router(customers.router)
app.include_router(segments.router)
app.include_router(campaigns.router)
app.include_router(webhooks.router)
app.include_router(channel_stub.router)

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "ok", "service": "xeno-crm"}

@app.get("/health")
def db_health_check(db: Session = Depends(get_db)):
    """Health check endpoint that tests DB connectivity."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "service": "xeno-crm", "database": "connected"}
    except Exception as e:
        return {"status": "error", "service": "xeno-crm", "database": "disconnected", "error": str(e)}

