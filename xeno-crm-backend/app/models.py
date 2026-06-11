"""
SQLAlchemy ORM models for Xeno CRM.

Five core tables:
  Customer  — shoppers with demographics, spend stats, and behavioural tags
  Order     — purchase history with line items
  Segment   — audience slices defined by filter rules or natural language
  Campaign  — outreach to a segment via a messaging channel
  Communication — individual message to a customer within a campaign
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text,
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Customer
# ---------------------------------------------------------------------------

class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    phone = Column(String)
    city = Column(String)
    gender = Column(String)            # "M" or "F"
    age = Column(Integer)
    total_orders = Column(Integer, default=0)
    total_spent = Column(Float, default=0.0)
    last_order_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    is_active = Column(Boolean, default=True)
    tags = Column(ARRAY(String), default=list)  # e.g. ["vip", "churned", "new"]

    # Relationships
    orders = relationship("Order", back_populates="customer", lazy="dynamic")
    communications = relationship("Communication", back_populates="customer", lazy="dynamic")

    def __repr__(self):
        return f"<Customer {self.name} ({self.email})>"


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

class Order(Base):
    __tablename__ = "orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    order_number = Column(String, unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    items = Column(JSON)               # [{name, category, quantity, price}, ...]
    channel = Column(String)           # "online" or "in-store"
    status = Column(String)            # "completed", "returned", "cancelled"
    city = Column(String)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    customer = relationship("Customer", back_populates="orders")

    def __repr__(self):
        return f"<Order {self.order_number} ₹{self.amount}>"


# ---------------------------------------------------------------------------
# Segment
# ---------------------------------------------------------------------------

class Segment(Base):
    __tablename__ = "segments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    filter_logic = Column(JSON)        # structured filter rules
    natural_language_query = Column(Text)  # the original NL input from marketer
    customer_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    created_by = Column(String, default="ai")  # "ai" or "manual"

    # Relationships
    campaigns = relationship("Campaign", back_populates="segment", lazy="dynamic")

    def __repr__(self):
        return f"<Segment '{self.name}' ({self.customer_count} customers)>"


# ---------------------------------------------------------------------------
# Campaign
# ---------------------------------------------------------------------------

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    segment_id = Column(UUID(as_uuid=True), ForeignKey("segments.id"), nullable=False)
    channel = Column(String)           # "whatsapp", "sms", "email", "rcs"
    message_template = Column(Text)    # message body with {{name}} placeholders
    status = Column(String, default="draft")  # "draft", "running", "completed", "failed"
    total_sent = Column(Integer, default=0)
    total_delivered = Column(Integer, default=0)
    total_failed = Column(Integer, default=0)
    total_opened = Column(Integer, default=0)
    total_clicked = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    segment = relationship("Segment", back_populates="campaigns")
    communications = relationship("Communication", back_populates="campaign", lazy="dynamic")

    def __repr__(self):
        return f"<Campaign '{self.name}' [{self.status}]>"


# ---------------------------------------------------------------------------
# Communication
# ---------------------------------------------------------------------------

class Communication(Base):
    __tablename__ = "communications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    recipient = Column(String)         # The phone number or email address
    channel = Column(String)           # "whatsapp", "sms", "email", "rcs"
    status = Column(String, default="queued")
    events_json = Column(JSON, default=list)  # [{event_type, timestamp, metadata}]
    sent_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    # Relationships
    campaign = relationship("Campaign", back_populates="communications")
    customer = relationship("Customer", back_populates="communications")

    def __repr__(self):
        return f"<Communication {self.id} [{self.status}]>"


# ---------------------------------------------------------------------------
# Channel Stub Log (Idempotency)
# ---------------------------------------------------------------------------

class ChannelStubLog(Base):
    """Stores logs of events dispatched by the channel stub for idempotency."""
    __tablename__ = "channel_stub_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(String, nullable=False)
    customer_id = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    def __repr__(self):
        return f"<ChannelStubLog {self.campaign_id} | {self.customer_id} | {self.event_type}>"
