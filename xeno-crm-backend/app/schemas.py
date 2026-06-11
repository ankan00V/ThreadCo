"""
Pydantic v2 schemas for request validation and response serialisation.

Naming convention:
  <Model>Base     — shared fields (used for creation)
  <Model>Response — full response with id and timestamps
  <Model>Request  — specialised request bodies
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ═══════════════════════════════════════════════════════════════════════════
# Customer
# ═══════════════════════════════════════════════════════════════════════════

class CustomerBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None       # "M" or "F"
    age: Optional[int] = None
    is_active: bool = True
    tags: list[str] = Field(default_factory=list)


class CustomerResponse(CustomerBase):
    id: UUID
    total_orders: int = 0
    total_spent: float = 0.0
    last_order_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# Order
# ═══════════════════════════════════════════════════════════════════════════

class OrderItem(BaseModel):
    name: str
    category: str
    quantity: int = 1
    price: float


class OrderBase(BaseModel):
    customer_id: UUID
    order_number: str
    amount: float
    items: list[OrderItem] = Field(default_factory=list)
    channel: str = "online"            # "online" or "in-store"
    status: str = "completed"          # "completed", "returned", "cancelled"
    city: Optional[str] = None


class OrderResponse(OrderBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# Segment
# ═══════════════════════════════════════════════════════════════════════════

class SegmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    filter_logic: Optional[dict] = None
    natural_language_query: Optional[str] = None
    created_by: str = "ai"             # "ai" or "manual"


class SegmentResponse(SegmentBase):
    id: UUID
    customer_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# Campaign
# ═══════════════════════════════════════════════════════════════════════════

class CampaignBase(BaseModel):
    name: str
    segment_id: UUID
    channel: str                       # "whatsapp", "sms", "email", "rcs"
    message_template: str              # message body with {{name}} placeholders


class CampaignResponse(CampaignBase):
    id: UUID
    status: str = "draft"
    total_sent: int = 0
    total_delivered: int = 0
    total_failed: int = 0
    total_opened: int = 0
    total_clicked: int = 0
    created_at: datetime
    sent_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ═══════════════════════════════════════════════════════════════════════════
# Communication
# ═══════════════════════════════════════════════════════════════════════════

class CommunicationBase(BaseModel):
    campaign_id: UUID
    customer_id: UUID
    channel: str
    status: str = "queued"


class CommunicationResponse(CommunicationBase):
    id: UUID
    events_json: list[dict]
    sent_at: Optional[datetime] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommunicationListResponse(BaseModel):
    items: list[CommunicationResponse]
    total: int
    page: int
    page_size: int


# ═══════════════════════════════════════════════════════════════════════════
# Specialised request schemas
# ═══════════════════════════════════════════════════════════════════════════

class CreateCampaignRequest(BaseModel):
    """Create a new campaign targeting a segment."""
    name: str
    segment_id: UUID
    channel: str                       # "whatsapp", "sms", "email", "rcs"
    message_template: str


class SendCampaignRequest(BaseModel):
    """Trigger sending for an existing campaign."""
    campaign_id: UUID


class NLSegmentRequest(BaseModel):
    """Natural language query from the marketer to create a segment."""
    query: str                         # e.g. "customers in Mumbai who spent over 5000"
    save: bool = False                 # whether to persist the segment to DB
    channel: str = "whatsapp"          # default channel for message drafting
    campaign_goal: str = ""            # goal context for AI message generation


class WebhookReceiptRequest(BaseModel):
    """Callback from the channel stub with delivery status."""
    campaign_id: UUID
    customer_id: UUID
    event_type: str                    # "delivered", "failed", "opened", "read", "clicked", "converted"
    timestamp: datetime
    metadata: Optional[dict] = None

class CampaignPerformanceResponse(BaseModel):
    campaign_id: UUID
    name: str
    status: str
    total_recipients: int
    sent: int
    delivered: int
    failed: int
    opened: int
    read: int
    clicked: int
    converted: int
    delivery_rate: float
    open_rate: float
    click_rate: float
    conversion_rate: float
    total_revenue_attributed: float

class GenerateMessageRequest(BaseModel):
    segment_id: UUID
    channel: str
    campaign_goal: str
