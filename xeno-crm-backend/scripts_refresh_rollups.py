"""
Refresh the materialized rollups that back the dashboard.

The dashboard reads mv_revenue_monthly, mv_city_revenue and mv_cohort_retention
instead of aggregating 1M orders on every page load. That trade buys ~300-700ms
per request and costs staleness, so the refresh has to actually run.

CONCURRENTLY keeps the views readable while they rebuild, which is why each one
has a unique index — CONCURRENTLY requires it.

Run from cron / a scheduled job:
    python scripts_refresh_rollups.py
"""

import os
import time

import psycopg2
from dotenv import load_dotenv

load_dotenv()

VIEWS = ("mv_revenue_monthly", "mv_city_revenue", "mv_cohort_retention")


def main() -> None:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set.")

    conn = psycopg2.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    for view in VIEWS:
        started = time.time()
        cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
        print(f"{view:24} refreshed in {time.time() - started:.2f}s")
    conn.close()


if __name__ == "__main__":
    main()
