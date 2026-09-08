"""
Database connection and session management.

Uses SQLAlchemy with PostgreSQL. Connection string is read from
the DATABASE_URL environment variable.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/xenocrm")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_timeout=30,
    connect_args={"connect_timeout": 30},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_performance_indexes() -> None:
    """Create indexes needed by existing databases as well as fresh installs.

    ``Base.metadata.create_all`` creates indexes with a new table, but does not
    reliably reconcile schema additions on an already-running deployment. These
    idempotent statements close that gap for the current small demo dataset.
    A high-volume production rollout should use versioned, concurrent Alembic
    migrations to avoid long-running DDL locks.
    """
    if engine.dialect.name != "postgresql":
        return

    statements = (
        "CREATE INDEX IF NOT EXISTS ix_customers_active_city_spend "
        "ON customers (is_active, city, total_spent)",
        "CREATE INDEX IF NOT EXISTS ix_customers_active_last_order "
        "ON customers (is_active, last_order_date)",
        "CREATE INDEX IF NOT EXISTS ix_customers_tags_gin "
        "ON customers USING GIN (tags)",
        "CREATE INDEX IF NOT EXISTS ix_orders_customer_created "
        "ON orders (customer_id, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_orders_status_created "
        "ON orders (status, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_communications_campaign_status "
        "ON communications (campaign_id, status)",
        "CREATE INDEX IF NOT EXISTS ix_communications_campaign_updated "
        "ON communications (campaign_id, updated_at)",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def get_db():
    """FastAPI dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
