"""
Order generator with realistic purchase behaviour.

The previous generator drew every order date uniformly at random over 24 months,
independent of the customer. That is the flaw the data-quality audit caught:
retention came out flat at ~23% in every cohort-month, and a churn model built
on it scored AUC 0.502 — chance — because past purchasing carried no information
about future purchasing.

This generator produces behaviour instead of noise:

  * Each customer gets a purchase intensity drawn lognormal, so a heavy tail of
    frequent buyers emerges rather than being imposed.
  * Inter-purchase intervals are exponential around that intensity, which is what
    creates a real recency signal — the whole basis of RFM.
  * A share of customers churn permanently at a sampled point in their lifetime,
    which is what makes churn predictable at all.
  * Basket size is lognormal around a per-customer mean, and in-store baskets run
    larger than online, matching how the two channels actually differ.
  * Festive-season months (Sep-Nov) carry an uplift, since this is Indian retail.
  * Return rates are higher online than in-store, as they are in reality.

Run:
    python generate_orders.py --orders 1000000 --budget-mb 460
"""

from __future__ import annotations

import argparse
import io
import math
import os
import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
from dotenv import load_dotenv

load_dotenv()

try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL is not set.")

CITIES = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Pune", "Ludhiana", "Jaipur",
          "Kolkata", "Ahmedabad", "Surat", "Lucknow", "Indore", "Kochi", "Chandigarh"]

# Indian retail peaks around the festive season and again for end-of-year sales.
SEASONALITY = {1: 0.85, 2: 0.80, 3: 0.90, 4: 0.95, 5: 1.00, 6: 0.95,
               7: 0.90, 8: 1.05, 9: 1.35, 10: 1.70, 11: 1.45, 12: 1.15}

HORIZON_DAYS = 730

SECONDARY_INDEXES = {
    "ix_orders_customer_created": "CREATE INDEX ix_orders_customer_created ON orders (customer_id, created_at)",
    "ix_orders_status_created":   "CREATE INDEX ix_orders_status_created ON orders (status, created_at)",
    "ix_orders_created_id_desc":  "CREATE INDEX ix_orders_created_id_desc ON orders (created_at DESC, id DESC)",
}


def db_size_mb(cur) -> float:
    cur.execute("SELECT pg_database_size(current_database())")
    return cur.fetchone()[0] / (1024 * 1024)


def customer_profile(rng: random.Random) -> dict:
    """Behavioural parameters for one customer."""
    # Orders per month. Lognormal gives a realistic heavy tail: most customers
    # buy rarely, a small minority buy often.
    intensity = min(rng.lognormvariate(math.log(1.45), 0.80), 12.0)

    # Mean basket. Independent-ish of frequency, so frequency and value are not
    # perfectly correlated — which is what makes segmentation non-trivial.
    basket_mean = rng.lognormvariate(math.log(2200), 0.75)

    # When they first appear, and how long they stay active.
    #
    # Lifetime is exponential, not uniform: in retail most customers lapse
    # quickly — a large share buy once and never return — while a minority stay
    # for years. Drawing it uniformly (the first attempt here) produced a
    # retention curve that dropped once and then sat flat, because survivors were
    # no more likely to lapse early than late. Exponential lifetimes give the
    # continuous decay real cohorts show.
    #
    # Frequent buyers also stick around longer, so lifetime scales mildly with
    # intensity. That correlation is part of what makes churn predictable.
    first_day = rng.uniform(0, HORIZON_DAYS * 0.9)
    loyalty = 0.6 + min(intensity, 3.0) * 0.5          # 0.6x - 2.1x
    active_days = rng.expovariate(1.0 / (75.0 * loyalty))

    # A small core never lapses inside the observation window.
    if rng.random() < 0.12:
        active_days = HORIZON_DAYS - first_day

    return {
        "intensity": intensity,
        "basket_mean": basket_mean,
        "first_day": first_day,
        "last_day": min(first_day + active_days, HORIZON_DAYS),
    }


def orders_for_customer(rng: random.Random, profile: dict, now: datetime, city: str):
    """Walk a customer's timeline, emitting orders at exponential intervals."""
    day = profile["first_day"]
    mean_gap = 30.0 / max(profile["intensity"], 0.05)

    while day < profile["last_day"]:
        created = now - timedelta(days=HORIZON_DAYS - day, minutes=rng.randint(0, 1439))

        # Seasonality biases whether a due purchase actually lands this month.
        if rng.random() < SEASONALITY.get(created.month, 1.0) / 1.7:
            # In-store baskets run larger; online is higher frequency, lower value.
            channel = "in-store" if rng.random() < 0.42 else "online"
            multiplier = 1.35 if channel == "in-store" else 0.85
            amount = round(max(rng.lognormvariate(math.log(profile["basket_mean"] * multiplier), 0.55), 199.0), 2)

            # Online returns run materially higher than in-store, as in reality.
            roll = rng.random()
            if channel == "online":
                status = "completed" if roll < 0.80 else ("returned" if roll < 0.94 else "cancelled")
            else:
                status = "completed" if roll < 0.91 else ("returned" if roll < 0.97 else "cancelled")

            yield created, amount, channel, status, city

        day += rng.expovariate(1.0 / mean_gap)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--orders", type=int, default=1_000_000)
    ap.add_argument("--budget-mb", type=float, default=460.0)
    ap.add_argument("--seed", type=int, default=20260909)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print(f"start db size: {db_size_mb(cur):.0f} MB")

    cur.execute("SELECT id::text, city FROM customers")
    customers = cur.fetchall()
    print(f"[gen] {len(customers):,} customers")

    print("[gen] dropping secondary indexes and truncating orders")
    for name in SECONDARY_INDEXES:
        cur.execute(f"DROP INDEX IF EXISTS {name}")
    cur.execute("TRUNCATE orders")
    conn.commit()

    now = datetime.now(timezone.utc)
    written = 0
    counter = 0
    started = time.time()
    buf = io.StringIO()
    batch_rows = 0

    try:
        for cid, city in customers:
            if written >= args.orders:
                break
            profile = customer_profile(rng)
            for created, amount, channel, status, ocity in orders_for_customer(rng, profile, now, city or "Mumbai"):
                counter += 1
                buf.write("\t".join([
                    str(uuid.uuid4()), cid, f"TC-{counter}", f"{amount}",
                    "\\N", channel, status, ocity, created.isoformat(),
                ]) + "\n")
                written += 1
                batch_rows += 1

            if batch_rows >= 50_000:
                buf.seek(0)
                cur.copy_expert(
                    "COPY orders (id,customer_id,order_number,amount,items,channel,status,city,created_at) FROM STDIN",
                    buf,
                )
                conn.commit()
                size = db_size_mb(cur)
                print(f"[gen] {written:,} orders  db={size:.0f} MB  {written/(time.time()-started):,.0f} rows/s")
                buf = io.StringIO()
                batch_rows = 0
                if size > args.budget_mb:
                    print(f"[gen] storage budget {args.budget_mb} MB reached — stopping at {written:,}.")
                    break

        if batch_rows:
            buf.seek(0)
            cur.copy_expert(
                "COPY orders (id,customer_id,order_number,amount,items,channel,status,city,created_at) FROM STDIN",
                buf,
            )
            conn.commit()
    finally:
        print("[gen] rebuilding secondary indexes")
        for name, ddl in SECONDARY_INDEXES.items():
            t0 = time.time()
            cur.execute(f"DROP INDEX IF EXISTS {name}")
            cur.execute(ddl)
            conn.commit()
            print(f"  {name} in {time.time()-t0:.1f}s")

    print("[gen] reconciling customer aggregates (set-based)")
    t0 = time.time()
    cur.execute("""
        UPDATE customers c
        SET total_orders = COALESCE(a.n, 0),
            total_spent  = COALESCE(a.spend, 0),
            last_order_date = a.last_order
        FROM (
            SELECT cu.id,
                   count(o.id) FILTER (WHERE o.status = 'completed')       AS n,
                   sum(o.amount) FILTER (WHERE o.status = 'completed')     AS spend,
                   max(o.created_at) FILTER (WHERE o.status = 'completed') AS last_order
            FROM customers cu LEFT JOIN orders o ON o.customer_id = cu.id
            GROUP BY cu.id
        ) a WHERE a.id = c.id
    """)
    conn.commit()
    print(f"  aggregates in {time.time()-t0:.1f}s")

    cur.execute("""
        UPDATE customers SET tags = (
            SELECT COALESCE(array_agg(t), '{}')
            FROM (
                SELECT 'vip' AS t WHERE total_spent > 15000
                UNION ALL SELECT 'churned' WHERE last_order_date IS NOT NULL
                    AND last_order_date < now() - interval '60 days' AND total_orders > 1
                UNION ALL SELECT 'new' WHERE created_at > now() - interval '30 days' AND total_orders <= 1
                UNION ALL SELECT 'loyal' WHERE total_orders >= 5
            ) s)
    """)
    conn.commit()

    cur.execute("ANALYZE orders")
    cur.execute("ANALYZE customers")
    conn.commit()

    cur.execute("SELECT count(*) FROM orders")
    total = cur.fetchone()[0]
    print(f"\nDONE  orders={total:,}  db={db_size_mb(cur):.0f} MB")
    conn.close()


if __name__ == "__main__":
    main()
