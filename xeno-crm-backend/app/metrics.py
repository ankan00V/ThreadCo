"""
Single source of truth for every number this product displays.

Before this module the app showed three different "revenue" figures on three
different screens, because each one was computed inline at the call site with a
different implicit definition. None of them were wrong; they answered different
questions and none of them said which. That is the failure mode this module
exists to prevent.

Every metric here carries its own definition string, and the API ships that
definition alongside the value so the UI can show a reader exactly what they
are looking at. If a number needs to change, it changes in one place.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Delivery states are monotonic (see STATUS_ORDER in the webhook ingestor): a
# message that reached 'clicked' necessarily passed through 'delivered' and
# 'opened'. Counting only the terminal state would badly under-report the funnel,
# which is exactly the bug that made the dashboard show a 0% open rate.
_DELIVERED_STATES = ("delivered", "opened", "read", "clicked", "converted")
_OPENED_STATES = ("opened", "read", "clicked", "converted")
_CLICKED_STATES = ("clicked", "converted")
_CONVERTED_STATES = ("converted",)


@dataclass(frozen=True)
class Metric:
    key: str
    label: str
    value: float | int | None
    definition: str
    unit: str = "count"
    caveat: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "value": self.value,
            "definition": self.definition,
            "unit": self.unit,
            "caveat": self.caveat,
        }


def _scalar(db: Session, sql: str) -> Any:
    return db.execute(text(sql)).scalar()


def _in_list(states: tuple[str, ...]) -> str:
    return ", ".join(f"'{s}'" for s in states)


def revenue_metrics(db: Session) -> list[Metric]:
    """The three revenue figures, each explicitly labelled rather than conflated."""
    net = _scalar(db, "SELECT COALESCE(sum(amount), 0) FROM orders WHERE status = 'completed'")
    gross = _scalar(db, "SELECT COALESCE(sum(amount), 0) FROM orders")
    completed = _scalar(db, "SELECT count(*) FROM orders WHERE status = 'completed'")

    return [
        Metric(
            key="net_revenue",
            label="Net revenue",
            value=round(float(net or 0), 2),
            unit="inr",
            definition="SUM(orders.amount) WHERE status = 'completed'",
            caveat="Excludes returned and cancelled orders. This is the headline revenue "
                   "figure everywhere in the product.",
        ),
        Metric(
            key="gross_revenue",
            label="Gross booked",
            value=round(float(gross or 0), 2),
            unit="inr",
            definition="SUM(orders.amount) across every order regardless of status",
            caveat="Includes returns and cancellations, so it always exceeds net revenue. "
                   "Shown only for reconciliation — it is not a performance number.",
        ),
        Metric(
            key="completed_orders",
            label="Completed orders",
            value=int(completed or 0),
            definition="COUNT(orders) WHERE status = 'completed'",
        ),
        Metric(
            key="aov",
            label="Average order value",
            value=round(float(net or 0) / completed, 2) if completed else 0.0,
            unit="inr",
            definition="net_revenue / completed_orders",
            caveat="Order-level average, not per-customer.",
        ),
    ]


def customer_metrics(db: Session) -> list[Metric]:
    total = _scalar(db, "SELECT count(*) FROM customers")
    active = _scalar(db, "SELECT count(*) FROM customers WHERE is_active = true")
    buyers = _scalar(db, "SELECT count(*) FROM customers WHERE total_orders > 0")

    return [
        Metric(
            key="total_customers", label="Customers", value=int(total or 0),
            definition="COUNT(customers)",
        ),
        Metric(
            key="active_customers", label="Active customers", value=int(active or 0),
            definition="COUNT(customers) WHERE is_active = true",
        ),
        Metric(
            key="purchasing_customers", label="Customers who have purchased",
            value=int(buyers or 0),
            definition="COUNT(customers) WHERE total_orders > 0",
            caveat="total_orders counts completed orders only, so a customer whose only "
                   "order was returned is not counted here.",
        ),
    ]


def delivery_metrics(db: Session) -> list[Metric]:
    """Campaign funnel computed from the communications event table.

    Deliberately NOT read from campaigns.total_opened / total_clicked. Those
    denormalized counters are currently zero while the underlying events exist,
    which is precisely why a dashboard should not trust a counter it did not
    recompute.
    """
    row = db.execute(text(f"""
        SELECT count(*)                                                          AS sent,
               count(*) FILTER (WHERE status IN ({_in_list(_DELIVERED_STATES)}))  AS delivered,
               count(*) FILTER (WHERE status IN ({_in_list(_OPENED_STATES)}))     AS opened,
               count(*) FILTER (WHERE status IN ({_in_list(_CLICKED_STATES)}))    AS clicked,
               count(*) FILTER (WHERE status IN ({_in_list(_CONVERTED_STATES)}))  AS converted,
               count(*) FILTER (WHERE status = 'failed')                          AS failed
        FROM communications
    """)).mappings().one()

    def rate(num: int, den: int) -> float:
        return round(num / den * 100, 1) if den else 0.0

    return [
        Metric(key="messages_sent", label="Messages sent", value=int(row["sent"]),
               definition="COUNT(communications)"),
        Metric(key="delivery_rate", label="Delivery rate",
               value=rate(row["delivered"], row["sent"]), unit="percent",
               definition="delivered / sent, where delivered counts any message that "
                          "reached delivered or beyond",
               caveat="Delivery states are monotonic, so a clicked message counts as "
                      "delivered and opened."),
        Metric(key="open_rate", label="Open rate",
               value=rate(row["opened"], row["delivered"]), unit="percent",
               definition="opened / delivered (not / sent)",
               caveat="Denominator is delivered messages — an undelivered message cannot "
                      "be opened. Quoting opens over sent would understate this."),
        Metric(key="click_rate", label="Click-through rate",
               value=rate(row["clicked"], row["opened"]), unit="percent",
               definition="clicked / opened"),
        Metric(key="conversion_rate", label="Conversion rate",
               value=rate(row["converted"], row["clicked"]), unit="percent",
               definition="converted / clicked",
               caveat="Delivery and engagement events in this demo are produced by the "
                      "channel simulator. They are real state transitions through the real "
                      "webhook pipeline, but they are not real customer behaviour and must "
                      "not be read as campaign lift."),
        Metric(key="failed_messages", label="Failed", value=int(row["failed"]),
               definition="COUNT(communications) WHERE status = 'failed'"),
    ]


def all_metrics(db: Session) -> dict[str, Any]:
    metrics = revenue_metrics(db) + customer_metrics(db) + delivery_metrics(db)
    return {
        "metrics": {m.key: m.as_dict() for m in metrics},
        "order": [m.key for m in metrics],
    }
