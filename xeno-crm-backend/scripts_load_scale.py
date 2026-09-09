"""
Scale loader for ThreadCo.

Grows the existing dataset to a size where query plans actually diverge:
sequential scans, deep OFFSET, and unindexed text search all become
measurable. Loads inside a hard storage budget because the target is a
Neon free-tier branch (~0.5 GB), aborting cleanly rather than pushing the
database into a read-only state.

Technique notes (these are the point of the exercise):
  * COPY ... FROM STDIN instead of row-by-row INSERT.
  * Secondary indexes on `orders` are dropped before the load and rebuilt
    after, so each batch does not pay per-row B-tree maintenance.
  * Customer aggregates are reconciled with one set-based UPDATE ... FROM,
    not a per-customer Python loop.
  * ANALYZE at the end so the planner has real statistics.

Usage:
    python scripts_load_scale.py --orders 1000000 --customers 120000 --budget-mb 400
"""

from __future__ import annotations

import argparse
import io
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
    raise SystemExit("DATABASE_URL is not set (put it in xeno-crm-backend/.env).")

FIRST_M = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Reyansh","Sai","Arnav","Dhruv","Kabir",
           "Rohan","Ishaan","Kartik","Varun","Rahul","Nikhil","Amit","Raj","Kunal","Manish",
           "Siddharth","Prateek","Ankit","Gaurav","Harsh","Yash","Devansh","Tanmay","Om","Krish"]
FIRST_F = ["Ananya","Diya","Myra","Aisha","Aadhya","Saanvi","Pari","Anika","Navya","Riya",
           "Priya","Kavya","Isha","Sneha","Meera","Pooja","Neha","Simran","Tanvi","Divya",
           "Nandini","Shruti","Aditi","Sakshi","Kritika","Ira","Anvi","Mahi","Rhea","Tara"]
LAST = ["Sharma","Verma","Patel","Gupta","Singh","Kumar","Reddy","Nair","Joshi","Iyer",
        "Malhotra","Kapoor","Mehta","Chopra","Bhat","Das","Chauhan","Agarwal","Pillai","Rao",
        "Banerjee","Deshmukh","Kulkarni","Saxena","Tiwari","Ghosh","Bose","Menon","Shetty","Jain"]
CITIES = ["Mumbai","Delhi","Bangalore","Chennai","Hyderabad","Pune","Ludhiana","Jaipur",
          "Kolkata","Ahmedabad","Surat","Lucknow","Indore","Kochi","Chandigarh"]
CHANNELS = ["online", "in-store"]
# Deliberately skewed: most orders complete, a realistic tail of returns/cancellations.
STATUS_POOL = ["completed"] * 78 + ["returned"] * 12 + ["cancelled"] * 10

SECONDARY_ORDER_INDEXES = {
    "ix_orders_customer_created": "CREATE INDEX ix_orders_customer_created ON orders (customer_id, created_at)",
    "ix_orders_status_created":   "CREATE INDEX ix_orders_status_created ON orders (status, created_at)",
    "ix_orders_city_status":      "CREATE INDEX ix_orders_city_status ON orders (city, status)",
    "ix_orders_created_at":       "CREATE INDEX ix_orders_created_at ON orders (created_at)",
}


def db_size_mb(cur) -> float:
    cur.execute("SELECT pg_database_size(current_database())")
    return cur.fetchone()[0] / (1024 * 1024)


def load_customers(conn, target: int, budget_mb: float) -> list[str]:
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM customers")
    existing = cur.fetchone()[0]
    print(f"[customers] existing={existing:,} target_new={target:,}")

    now = datetime.now(timezone.utc)
    ids: list[str] = []
    batch = 20_000
    done = 0

    while done < target:
        n = min(batch, target - done)
        buf = io.StringIO()
        for i in range(n):
            cid = str(uuid.uuid4())
            ids.append(cid)
            gender = random.choice(["M", "F"])
            first = random.choice(FIRST_M if gender == "M" else FIRST_F)
            last = random.choice(LAST)
            seq = existing + done + i
            name = f"{first} {last}"
            email = f"{first.lower()}.{last.lower()}{seq}@threadco-demo.in"
            created = now - timedelta(days=random.randint(0, 730), minutes=random.randint(0, 1439))
            buf.write("\t".join([
                cid, name, email,
                f"+91{random.randint(6000000000, 9999999999)}",
                random.choice(CITIES), gender, str(random.randint(18, 62)),
                "0", "0", "\\N",
                created.isoformat(), "true", "{}",
            ]) + "\n")
        buf.seek(0)
        cur.copy_expert(
            "COPY customers (id,name,email,phone,city,gender,age,total_orders,"
            "total_spent,last_order_date,created_at,is_active,tags) FROM STDIN",
            buf,
        )
        conn.commit()
        done += n
        size = db_size_mb(cur)
        print(f"[customers] {done:,}/{target:,}  db={size:.0f} MB")
        if size > budget_mb:
            print(f"[customers] storage budget {budget_mb} MB reached — stopping early.")
            break
    return ids


def load_orders(conn, customer_ids: list[str], target: int, budget_mb: float) -> int:
    cur = conn.cursor()

    print("[orders] dropping secondary indexes before bulk load")
    for name in SECONDARY_ORDER_INDEXES:
        cur.execute(f"DROP INDEX IF EXISTS {name}")
    conn.commit()

    cur.execute("SELECT count(*) FROM orders")
    existing = cur.fetchone()[0]
    cur.execute("SELECT coalesce(max(substring(order_number from 4)::bigint), 1000) FROM orders "
                "WHERE order_number ~ '^TC-[0-9]+$'")
    counter = cur.fetchone()[0]
    print(f"[orders] existing={existing:,} target_new={target:,} order_no starts at {counter+1}")

    now = datetime.now(timezone.utc)
    batch = 50_000
    done = 0
    started = time.time()

    try:
        while done < target:
            n = min(batch, target - done)
            buf = io.StringIO()
            for i in range(n):
                counter += 1
                cid = random.choice(customer_ids)
                # Log-ish spend distribution: many small baskets, a long premium tail.
                amount = round(random.choice([
                    random.uniform(400, 2500),
                    random.uniform(400, 2500),
                    random.uniform(2500, 8000),
                    random.uniform(8000, 25000),
                ]), 2)
                created = now - timedelta(days=random.randint(0, 730), minutes=random.randint(0, 1439))
                buf.write("\t".join([
                    str(uuid.uuid4()), cid, f"TC-{counter}", f"{amount}",
                    "\\N",  # items intentionally NULL for bulk rows — storage budget
                    random.choice(CHANNELS), random.choice(STATUS_POOL),
                    random.choice(CITIES), created.isoformat(),
                ]) + "\n")
            buf.seek(0)
            cur.copy_expert(
                "COPY orders (id,customer_id,order_number,amount,items,channel,status,city,created_at) "
                "FROM STDIN",
                buf,
            )
            conn.commit()
            done += n
            size = db_size_mb(cur)
            rate = done / max(time.time() - started, 0.001)
            print(f"[orders] {done:,}/{target:,}  db={size:.0f} MB  {rate:,.0f} rows/s")
            if size > budget_mb:
                print(f"[orders] storage budget {budget_mb} MB reached — stopping early at {done:,}.")
                break
    finally:
        print("[orders] rebuilding secondary indexes")
        for name, ddl in SECONDARY_ORDER_INDEXES.items():
            t0 = time.time()
            cur.execute(f"DROP INDEX IF EXISTS {name}")
            cur.execute(ddl)
            conn.commit()
            print(f"  built {name} in {time.time()-t0:.1f}s")
    return done


def reconcile(conn) -> None:
    """One set-based pass replaces the O(n^2) per-customer Python loop."""
    cur = conn.cursor()

    print("[reconcile] recomputing customer aggregates from orders")
    t0 = time.time()
    cur.execute("""
        UPDATE customers c
        SET total_orders = COALESCE(a.n, 0),
            total_spent  = COALESCE(a.spend, 0),
            last_order_date = a.last_order
        FROM (
            SELECT cu.id,
                   count(o.id) FILTER (WHERE o.status = 'completed')      AS n,
                   sum(o.amount) FILTER (WHERE o.status = 'completed')    AS spend,
                   max(o.created_at) FILTER (WHERE o.status = 'completed') AS last_order
            FROM customers cu
            LEFT JOIN orders o ON o.customer_id = cu.id
            GROUP BY cu.id
        ) a
        WHERE a.id = c.id
    """)
    conn.commit()
    print(f"  aggregates in {time.time()-t0:.1f}s")

    print("[reconcile] recomputing behavioural tags")
    t0 = time.time()
    cur.execute("""
        UPDATE customers SET tags = (
            SELECT COALESCE(array_agg(t), '{}')
            FROM (
                SELECT 'vip'     AS t WHERE total_spent > 15000
                UNION ALL
                SELECT 'churned' WHERE last_order_date IS NOT NULL
                                   AND last_order_date < now() - interval '60 days'
                                   AND total_orders > 1
                UNION ALL
                SELECT 'new'     WHERE created_at > now() - interval '30 days'
                                   AND total_orders <= 1
                UNION ALL
                SELECT 'loyal'   WHERE total_orders >= 5
            ) s
        )
    """)
    conn.commit()
    print(f"  tags in {time.time()-t0:.1f}s")

    print("[reconcile] ANALYZE")
    cur.execute("ANALYZE customers")
    cur.execute("ANALYZE orders")
    conn.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--orders", type=int, default=1_000_000)
    ap.add_argument("--customers", type=int, default=120_000)
    ap.add_argument("--budget-mb", type=float, default=400.0)
    args = ap.parse_args()

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    print(f"start db size: {db_size_mb(cur):.0f} MB  budget: {args.budget_mb:.0f} MB")

    new_ids = load_customers(conn, args.customers, args.budget_mb)

    cur.execute("SELECT id::text FROM customers TABLESAMPLE SYSTEM (100) LIMIT 5000")
    pool = list({r[0] for r in cur.fetchall()} | set(new_ids))
    print(f"[orders] customer id pool: {len(pool):,}")

    loaded = load_orders(conn, pool, args.orders, args.budget_mb)
    reconcile(conn)

    cur.execute("SELECT count(*) FROM customers")
    ccount = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM orders")
    ocount = cur.fetchone()[0]
    print(f"\nDONE  customers={ccount:,}  orders={ocount:,}  db={db_size_mb(cur):.0f} MB  new_orders={loaded:,}")
    conn.close()


if __name__ == "__main__":
    main()
