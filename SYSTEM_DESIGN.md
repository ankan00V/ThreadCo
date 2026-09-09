# ThreadCo — system design

Companion to the [README](./README.md). This covers the decisions that are not visible from the UI:
indexing strategy, what partitioning would buy, where this architecture stops working, and what the
free-tier constraints forced.

---

## 1. Working set

| | |
|---|---|
| Customers | 145,000 |
| Orders | 1,010,928 (787,606 completed) |
| Communications | 1,158 |
| Database size | 480 MB (heap 203 MB, indexes ~233 MB) |
| Host | Neon serverless Postgres 18, free branch (~0.5 GB) |

Indexes outweigh the heap. That is normal for a read-heavy analytical workload and it is also a
liability worth stating: every index is paid for twice, in storage and in write amplification.

---

## 2. Indexing strategy

| Index | Serves | Note |
|---|---|---|
| `ix_customers_active_city_spend` | directory filter + sort | Composite ordered for the filter's shape: equality columns first, range/sort last |
| `ix_customers_active_last_order` | lapsed-customer segments | |
| `ix_customers_tags_gin` | `tags @> ARRAY[...]` segment matching | GIN, because the predicate is array containment |
| `ix_customers_search_trgm` | `ILIKE '%…%'` search | GIN + `pg_trgm` on `(name \|\| ' ' \|\| email)`; 11 MB |
| `ix_orders_customer_created` | a customer's order history | |
| `ix_orders_status_created` | completed-order time series | |
| `ix_orders_created_id_desc` | keyset pagination | `(created_at DESC, id DESC)` — must match the `ORDER BY` exactly, including direction |

**Two indexes were removed**, which matters as much as the ones added:

- `ix_orders_created_at` — every time-series query in this application filters on `status` first, so
  `ix_orders_status_created` already serves them. It was 19 MB of pure write overhead. It was later
  effectively replaced by `ix_orders_created_id_desc`, which has a *specific* access path behind it.
- `ix_orders_city_status` — no query shape in the codebase matched it.

The lesson from the search index is worth recording: the query had to be rewritten to
`(name || ' ' || email) ILIKE …` before the index could be used at all. Two separate `ILIKE`
predicates OR'd together cannot use an expression index on the concatenation. **An index is only
useful if the query is written in the shape the index expects.**

### Choosing between GIN and B-tree

B-tree indexes order values, so they can only accelerate a `LIKE` pattern anchored at the start
(`'sharm%'`). A leading wildcard has no prefix to seek on. Trigram GIN indexes the three-character
substrings instead, which is why `'%sharm%'` becomes an index lookup — at the cost of a larger,
slower-to-update index. For a search box over a mostly-static customer table, that trade is right.

---

## 3. Partitioning

**Deployed and measured.** `orders_partitioned` holds the same 538,026 rows as a plain control
table, `orders_flat`, in 25 monthly `RANGE` partitions plus a default. Identical columns, identical
rows — the only variable is the partitioning, so the comparison means something.

```sql
CREATE TABLE orders_partitioned (...) PARTITION BY RANGE (created_at);
CREATE TABLE orders_p_2025_10 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

A one-month aggregate:

| | Relations scanned | Execution |
|---|---|---|
| `orders_flat` (indexed) | 1 table covering 2 years | 15.2 ms |
| `orders_partitioned` | 1 partition — **25 of 26 pruned** | 7.6 ms |

**The time saved is the least interesting part.** The control is indexed, so it was never in
trouble; 2× is a modest win. Pruning earns its keep elsewhere:

- **Retention becomes `DROP TABLE orders_p_2024_09`** instead of a `DELETE` that leaves dead tuples
  for vacuum to reclaim — which, on this free-tier branch, is the difference between reclaiming
  space instantly and running out of it.
- **Each partition's index stays small** enough to stay cached.
- **Maintenance runs per month** rather than over the whole table.

The costs are just as real, and they are why this is a decision rather than a default:

- Every unique constraint must include the partition key. `order_number` is globally unique on the
  real `orders` table; under partitioning it would have to become unique per-partition or move to a
  lookup table.
- A query **without** a `created_at` predicate now touches all 26 partitions instead of one table.
  `WHERE order_number = ?` is exactly that query.
- Partition creation becomes an operational job that can fail at midnight.

The narrow column set (`id, customer_id, amount, status, created_at`) is deliberate: a second copy
of the full table would not fit the 512 MB branch, and the omitted columns play no part in a
date-range scan. Built by `scripts_build_partitions.py`; the comparison runs live as the
"partition-pruning" case study in the Performance Lab.

---

## 4. Materialized views, and their real cost

Three rollups back the dashboard:

| View | Replaces | Refresh |
|---|---|---|
| `mv_revenue_monthly` | 318 ms aggregation over 787K completed orders | 0.9 s |
| `mv_city_revenue` | 774 ms join + aggregate | 1.2 s |
| `mv_cohort_retention` | 2.6 s cohort self-join | 2.4 s |

Each has a unique index, which `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires; without
`CONCURRENTLY` the refresh takes an `ACCESS EXCLUSIVE` lock and the dashboard blocks.

The trade is staleness. A revenue trend that is fifteen minutes behind is fine. A live delivery
counter would not be, which is why campaign delivery metrics are still computed on demand from
`communications` rather than rolled up.

---

## 5. Where this stops working

Current architecture is sound to roughly **10M orders**. Beyond that:

| Pressure | First symptom | Response |
|---|---|---|
| Order volume | Rollup refresh exceeds its window | Incremental refresh keyed on watermark, not full rebuild |
| Write concurrency | Webhook ingestion contends on `communications` | Queue (Redis/Kafka) in front of the ingestor; batch the writes |
| Dashboard fan-out | Many concurrent aggregate readers | Read replica for analytics, separated from the write path |
| Storage | Neon branch limit | Partition + archive cold months to object storage |

### When to leave Postgres

At ~100M+ rows with scan-heavy aggregation across many columns, a row store stops being the right
shape. Every one of these rollups reads two or three columns out of a nine-column row, and Postgres
still pulls whole pages. A columnar engine — Redshift, StarRocks, Databricks — stores those columns
contiguously, compresses them far better because neighbouring values are similar, and parallelises
the scan across nodes.

The honest trigger is not row count but **query shape**: when most queries are wide aggregate scans
rather than selective point lookups, and when the working set no longer fits in cache. This workload
is not there. The CRM's operational reads — customer directory, campaign status, delivery tracking —
are point lookups and short ranges, which is exactly what Postgres is good at. Splitting analytics
into a warehouse while operations stay on Postgres is the normal end state; doing it before the pain
arrives just buys two systems to keep in sync.

---

## 6. Data quality as a design concern

The dataset is generated, and the generator has known deficiencies that are documented in the
product rather than hidden: order dates are uniform (so retention is flat and unpredictable), and
channel is independent of basket size (so AOV is identical across channels). See
[/analysis](https://thread-co-beige.vercel.app/analysis).

This is treated as a design property, not a caveat in a footnote. A metric layer that reports
numbers without saying what they mean, on data whose limitations aren't stated, is how a dashboard
ends up being confidently wrong. The two failing checks would be a blocker before any of the
retention conclusions could be acted on, and the app says so on the page where those charts live.

---

## 7. AI-assisted development

The LLM (NVIDIA NIM, Nemotron) was used for scaffolding — route boilerplate, Recharts configuration,
the channel state machine's first draft. It was not used for the parts that required judgment, and
two of its outputs were rejected outright:

- A campaign completion checker that read `queued == 0` before all rows were inserted — a race that
  marked campaigns complete early. Replaced with a check against `total_count == campaign.total_sent`.
- A churn model that defined the label from a feature (`recency_days > 90` predicted from
  `recency_days`). Scored near-perfect AUC and was worthless. Rewritten with a temporal split; it now
  scores 0.502, which is the correct answer for this data.

The second one is the more useful example. The code ran, produced an impressive number, and was
wrong in a way that only shows up if you know what to look for.
