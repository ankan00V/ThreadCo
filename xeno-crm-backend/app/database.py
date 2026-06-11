"""
Database connection and session management.

Uses SQLAlchemy with PostgreSQL. Connection string is read from
the DATABASE_URL environment variable.
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
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


def get_db():
    """FastAPI dependency that yields a database session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
