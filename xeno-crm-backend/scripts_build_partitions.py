"""
Build a partitioning demonstration: the same rows, stored two ways.

The JD names partitioning strategies explicitly, and reasoning about it in a
design document is weaker than showing the planner prune. This creates two
tables with identical columns and identical rows — one plain, one RANGE
partitioned by month — so the only variable between them is the partitioning.

Narrow columns on purpose. A second copy of the full `orders` table would not
fit the free-tier branch, and the columns dropped (order_number, city, channel,
items) play no part in a date-range scan, so keeping them would cost storage
without changing what the comparison shows.

Run:
    python scripts_build_partitions.py
"""

from __future__ import annotations

import os
import time
from datetime import date, timedelta

import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise SystemExit("DATABASE_URL is not set.")

COLUMNS = "(id, customer_id, amount, status, created_at)"


def month_starts(first: date, last: date):
    cursor = date(first.year, first.month, 1)
    while cursor <= last:
        nxt = date(cursor.year + (cursor.month == 12), (cursor.month % 12) + 1, 1)
        yield cursor, nxt
        cursor = nxt


def main() -> None:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT pg_database_size(current_database())/1048576")
    print(f"db before: {cur.fetchone()[0]} MB")

    print("dropping any previous build")
    cur.execute("DROP TABLE IF EXISTS orders_partitioned CASCADE")
    cur.execute("DROP TABLE IF EXISTS orders_flat CASCADE")

    # --- Plain table: the control ------------------------------------------
    print("building orders_flat (control)")
    t0 = time.time()
    cur.execute("""
        CREATE TABLE orders_flat (
            id          uuid NOT NULL,
            customer_id uuid NOT NULL,
            amount      double precision NOT NULL,
            status      text,
            created_at  timestamptz NOT NULL
        )
    """)
    cur.execute(f"INSERT INTO orders_flat {COLUMNS} SELECT id, customer_id, amount, status, created_at FROM orders")
    cur.execute("CREATE INDEX ix_orders_flat_created ON orders_flat (created_at)")
    cur.execute("ANALYZE orders_flat")
    print(f"  {time.time()-t0:.1f}s")

    # --- Partitioned table: monthly RANGE on created_at ---------------------
    print("building orders_partitioned")
    t0 = time.time()
    cur.execute("""
        CREATE TABLE orders_partitioned (
            id          uuid NOT NULL,
            customer_id uuid NOT NULL,
            amount      double precision NOT NULL,
            status      text,
            created_at  timestamptz NOT NULL
        ) PARTITION BY RANGE (created_at)
    """)

    cur.execute("SELECT min(created_at)::date, max(created_at)::date FROM orders")
    first, last = cur.fetchone()

    made = 0
    for start, end in month_starts(first, last + timedelta(days=1)):
        name = f"orders_p_{start.year}_{start.month:02d}"
        cur.execute(
            f"CREATE TABLE {name} PARTITION OF orders_partitioned "
            f"FOR VALUES FROM (%s) TO (%s)", (start, end)
        )
        made += 1
    # Anything outside the known range still has a home rather than erroring.
    cur.execute("CREATE TABLE orders_p_default PARTITION OF orders_partitioned DEFAULT")
    print(f"  {made} monthly partitions + default")

    cur.execute(f"INSERT INTO orders_partitioned {COLUMNS} SELECT id, customer_id, amount, status, created_at FROM orders")
    # Indexing the parent cascades to every partition, existing and future.
    cur.execute("CREATE INDEX ix_orders_part_created ON orders_partitioned (created_at)")
    cur.execute("ANALYZE orders_partitioned")
    print(f"  {time.time()-t0:.1f}s")

    cur.execute("SELECT count(*) FROM orders_flat")
    flat_rows = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM orders_partitioned")
    part_rows = cur.fetchone()[0]
    print(f"rows: flat={flat_rows:,} partitioned={part_rows:,} identical={flat_rows == part_rows}")

    for table in ("orders_flat", "orders_partitioned"):
        cur.execute("SELECT pg_size_pretty(pg_total_relation_size(%s))", (table,))
        print(f"  {table:22} {cur.fetchone()[0]}")

    cur.execute("SELECT pg_database_size(current_database())/1048576")
    print(f"db after: {cur.fetchone()[0]} MB")
    conn.close()


if __name__ == "__main__":
    main()
