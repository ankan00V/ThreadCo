"""
Seed script for Xeno CRM — populates the database with realistic ThreadCo data.

Run standalone:
    python -m app.seed

Creates:
  - 50 customers with realistic Indian names, cities, and demographics
  - 200+ orders with fashion items spread across the last 12 months
  - 2 pre-built segments (High Value Customers, Lapsed Customers)

After inserting orders, recomputes each customer's total_orders, total_spent,
and last_order_date from their actual order data, then assigns behavioural tags.
"""

import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from app.database import SessionLocal, engine, Base
from app.models import Customer, Order, Segment


# ---------------------------------------------------------------------------
# Realistic data pools
# ---------------------------------------------------------------------------

FIRST_NAMES_M = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Sai",
    "Arnav", "Dhruv", "Kabir", "Rohan", "Ishaan", "Kartik", "Varun",
    "Rahul", "Nikhil", "Amit", "Raj", "Kunal", "Manish", "Siddharth",
    "Prateek", "Ankit", "Gaurav", "Harsh",
]

FIRST_NAMES_F = [
    "Ananya", "Diya", "Myra", "Aisha", "Aadhya", "Saanvi", "Pari",
    "Anika", "Navya", "Riya", "Priya", "Kavya", "Isha", "Sneha",
    "Meera", "Pooja", "Neha", "Simran", "Tanvi", "Divya", "Nandini",
    "Shruti", "Aditi", "Sakshi", "Kritika",
]

LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Gupta", "Singh", "Kumar", "Reddy",
    "Nair", "Joshi", "Iyer", "Malhotra", "Kapoor", "Mehta", "Chopra",
    "Bhat", "Das", "Chauhan", "Agarwal", "Pillai", "Rao", "Banerjee",
    "Deshmukh", "Kulkarni", "Saxena", "Tiwari",
]

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Ludhiana", "Jaipur"]

FASHION_ITEMS = [
    {"name": "Cotton Kurta",           "category": "ethnic",      "price_range": (800, 2500)},
    {"name": "Silk Saree",             "category": "ethnic",      "price_range": (2000, 7000)},
    {"name": "Slim Fit Jeans",         "category": "western",     "price_range": (1200, 3000)},
    {"name": "Casual T-Shirt",         "category": "western",     "price_range": (500, 1500)},
    {"name": "Leather Sneakers",       "category": "footwear",    "price_range": (1800, 4500)},
    {"name": "Denim Jacket",           "category": "outerwear",   "price_range": (2000, 5000)},
    {"name": "Chino Trousers",         "category": "western",     "price_range": (1000, 2500)},
    {"name": "Block-Print Dupatta",    "category": "ethnic",      "price_range": (600, 1800)},
    {"name": "Linen Shirt",            "category": "western",     "price_range": (900, 2200)},
    {"name": "Running Shoes",          "category": "footwear",    "price_range": (1500, 4000)},
    {"name": "Embroidered Kurti",      "category": "ethnic",      "price_range": (700, 2000)},
    {"name": "Palazzo Pants",          "category": "ethnic",      "price_range": (800, 1800)},
    {"name": "Polo Shirt",             "category": "western",     "price_range": (800, 2000)},
    {"name": "Wool Blazer",            "category": "outerwear",   "price_range": (3000, 7500)},
    {"name": "Canvas Tote Bag",        "category": "accessories", "price_range": (500, 1500)},
    {"name": "Printed Scarf",          "category": "accessories", "price_range": (400, 1200)},
    {"name": "Leather Belt",           "category": "accessories", "price_range": (600, 1500)},
    {"name": "Graphic Hoodie",         "category": "western",     "price_range": (1200, 3000)},
    {"name": "Churidar Set",           "category": "ethnic",      "price_range": (1000, 3500)},
    {"name": "Sports Sandals",         "category": "footwear",    "price_range": (800, 2000)},
]

ORDER_CHANNELS = ["online", "in-store"]
ORDER_STATUSES = ["completed", "completed", "completed", "completed", "returned", "cancelled"]
# Weighted: 67% completed, 17% returned, 17% cancelled


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _random_phone():
    """Generate a realistic Indian mobile number in +91 format."""
    return f"+91{random.choice(['6','7','8','9'])}{random.randint(100000000, 999999999)}"


def _random_email(first: str, last: str):
    """Generate a plausible email from a name."""
    domain = random.choice(["gmail.com", "outlook.com", "yahoo.co.in", "hotmail.com"])
    sep = random.choice([".", "_", ""])
    suffix = random.randint(1, 999)
    return f"{first.lower()}{sep}{last.lower()}{suffix}@{domain}"


def _random_date_in_last_n_days(n: int) -> datetime:
    """Return a timezone-aware UTC datetime within the last n days."""
    offset = random.randint(0, n)
    return datetime.now(timezone.utc) - timedelta(days=offset, hours=random.randint(0, 23), minutes=random.randint(0, 59))


def _generate_order_items() -> list[dict]:
    """Pick 1–4 random fashion items and return them as line items."""
    count = random.randint(1, 4)
    chosen = random.sample(FASHION_ITEMS, min(count, len(FASHION_ITEMS)))
    items = []
    for item in chosen:
        qty = random.randint(1, 3)
        price = round(random.uniform(*item["price_range"]), 2)
        items.append({
            "name": item["name"],
            "category": item["category"],
            "quantity": qty,
            "price": price,
        })
    return items


def _compute_tags(customer: Customer, now: datetime) -> list[str]:
    """Assign behavioural tags based on spend, recency, and order count."""
    tags = []

    if customer.total_spent > 15000:
        tags.append("vip")

    if (
        customer.last_order_date
        and (now - customer.last_order_date).days > 60
        and customer.total_orders > 1
    ):
        tags.append("churned")

    if (
        customer.created_at
        and (now - customer.created_at).days < 30
        and customer.total_orders <= 1
    ):
        tags.append("new")

    if customer.total_orders >= 5:
        tags.append("loyal")

    return tags


# ---------------------------------------------------------------------------
# Main seed logic
# ---------------------------------------------------------------------------

def seed():
    """Populate the database with ThreadCo sample data."""

    # Drop and recreate all tables
    print("Dropping existing tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    now = datetime.now(timezone.utc)

    try:
        # ------------------------------------------------------------------
        # 1. Create 1500 customers
        # ------------------------------------------------------------------
        customers: list[Customer] = []
        used_emails: set[str] = set()

        for i in range(1500):
            gender = random.choice(["M", "F"])
            first = random.choice(FIRST_NAMES_M if gender == "M" else FIRST_NAMES_F)
            last = random.choice(LAST_NAMES)
            name = f"{first} {last}"

            # Ensure unique email
            email = _random_email(first, last)
            while email in used_emails:
                email = _random_email(first, last)
            used_emails.add(email)

            # Spread created_at across the last 12 months so some customers qualify as "new"
            if i < 300:
                # 300 recent customers (created in the last 20 days)
                created = now - timedelta(days=random.randint(1, 20))
            else:
                created = now - timedelta(days=random.randint(30, 365))

            customer = Customer(
                id=uuid.uuid4(),
                name=name,
                email=email,
                phone=_random_phone(),
                city=random.choice(CITIES),
                gender=gender,
                age=random.randint(18, 55),
                created_at=created,
                is_active=True,
                tags=[],
            )
            customers.append(customer)

        print(f"  ✓ Created {len(customers)} customers")

        # ------------------------------------------------------------------
        # 2. Create 200+ orders spread across customers
        # ------------------------------------------------------------------
        orders: list[Order] = []
        order_counter = 1000

        # Distribute orders unevenly — some customers get many, some get few
        order_counts = (
            [random.randint(20, 25) for _ in range(250)]
            + [random.randint(6, 12) for _ in range(250)]
            + [random.randint(3, 6) for _ in range(500)]
            + [random.randint(0, 3) for _ in range(500)]
        )
        random.shuffle(order_counts)

        for customer, n_orders in zip(customers, order_counts):
            for _ in range(n_orders):
                order_counter += 1
                items = _generate_order_items()
                amount = round(sum(it["price"] * it["quantity"] for it in items), 2)

                order = Order(
                    id=uuid.uuid4(),
                    customer_id=customer.id,
                    order_number=f"TC-{order_counter}",
                    amount=amount,
                    items=items,
                    channel=random.choice(ORDER_CHANNELS),
                    status=random.choice(ORDER_STATUSES),
                    city=customer.city,
                    created_at=_random_date_in_last_n_days(365),
                )
                orders.append(order)

        print(f"  ✓ Created {len(orders)} orders")

        # ------------------------------------------------------------------
        # 3. Recompute customer aggregates from actual orders
        # ------------------------------------------------------------------
        for customer in customers:
            customer_orders = [o for o in orders if o.customer_id == customer.id]
            completed = [o for o in customer_orders if o.status == "completed"]

            customer.total_orders = len(completed)
            customer.total_spent = round(sum(o.amount for o in completed), 2)

            if completed:
                customer.last_order_date = max(o.created_at for o in completed)
            else:
                customer.last_order_date = None

            customer.tags = _compute_tags(customer, now)

        print("  ✓ Recomputed customer aggregates and tags")

        # Save everything to the database in bulk!
        print("  ✓ Bulk saving customers and orders to the remote database...")
        db.bulk_save_objects(customers)
        db.bulk_save_objects(orders)

        # ------------------------------------------------------------------
        # 4. Create 2 pre-built segments
        # ------------------------------------------------------------------
        # High Value Customers: total_spent > 10000
        hv_count = sum(1 for c in customers if c.total_spent > 10000)
        seg_hv = Segment(
            id=uuid.uuid4(),
            name="High Value Customers",
            description="Customers who have spent more than ₹10,000 in total — prime targets for premium collections and early access.",
            filter_logic={"min_spent": 10000},
            natural_language_query="customers who spent more than 10000 rupees",
            customer_count=hv_count,
            created_by="manual",
        )
        db.add(seg_hv)

        # Lapsed Customers: last order > 45 days ago
        lapsed_count = sum(
            1 for c in customers
            if c.last_order_date and (now - c.last_order_date).days > 45
        )
        seg_lapsed = Segment(
            id=uuid.uuid4(),
            name="Lapsed Customers",
            description="Customers whose last purchase was over 45 days ago — candidates for win-back campaigns.",
            filter_logic={"days_since_last_order": 45},
            natural_language_query="customers who haven't ordered in the last 45 days",
            customer_count=lapsed_count,
            created_by="manual",
        )
        db.add(seg_lapsed)

        db.commit()

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        print()
        print(f"Seeded {len(customers)} customers, {len(orders)} orders, 2 segments.")
        print(f"  → High Value Customers: {hv_count} matches")
        print(f"  → Lapsed Customers:     {lapsed_count} matches")
        print()

        # Tag distribution
        tag_counts: dict[str, int] = {}
        for c in customers:
            for t in c.tags:
                tag_counts[t] = tag_counts.get(t, 0) + 1
        if tag_counts:
            print("  Tag distribution:")
            for tag, count in sorted(tag_counts.items()):
                print(f"    {tag}: {count}")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    seed()
