# ThreadCo — customer analytics on a million-row Postgres dataset

**Live:** https://thread-co-beige.vercel.app · **API:** https://threadco-api.onrender.com/health

A retail CRM whose interesting part is underneath the UI: **1,010,928 orders and 145,000 customers
in Neon Postgres**, the query-performance work needed to keep it responsive at that size, one
definition per metric, and a data-quality audit that tells you which questions this dataset cannot
answer.

Three pages are worth your time:

| Page | What it shows |
|------|---------------|
| **[/workbench](https://thread-co-beige.vercel.app/workbench)** — Query Performance Lab | Six queries run live, both the slow way and the fast way, reporting PostgreSQL's own execution time. Plus a SQL console you can type into. |
| **[/analysis](https://thread-co-beige.vercel.app/analysis)** — Written analysis | A cohort retention audit that concludes the dataset **cannot** support retention conclusions, and explains how that was detected. |
| **[/analytics](https://thread-co-beige.vercel.app/analytics)** | Business metrics, each carrying its own definition. |

---

## 1. Query performance at scale

Every "before" below is a pattern that was genuinely in this codebase when the database held 1,500
customers, where all of them ran in single-digit milliseconds. Measurements are PostgreSQL's
`Execution Time` from `EXPLAIN (ANALYZE, BUFFERS)` — not wall clock, which on a serverless database
mostly measures the network round trip.

| Case | Before | After | Change |
|------|-------:|------:|--------|
| Deep pagination (`OFFSET` ~910k) | 1,039 ms | 0.09 ms | **~12,000×** |
| Monthly revenue rollup | 318 ms | 0.04 ms | ~7,000× |
| Pagination total (`COUNT(*)`) | 22 ms | 0.04 ms | ~500× |
| Customer text search (`ILIKE '%…%'`) | 107 ms | 7 ms | ~15× |
| Revenue by city (unnecessary join) | 774 ms | 303 ms | ~2.5× |
| Lifecycle tags (aggregate in app) | 35 ms | 146 ms | **slower** — but 143,096 rows → 4 |

Run them yourself at [/workbench](https://thread-co-beige.vercel.app/workbench). Numbers vary a
little per run; the page shows whatever it just measured.

**The two most interesting rows are the ones that aren't clean wins.**

- **Deep pagination** is a ~12,000× speedup where *both sides use the same index*. `OFFSET` is not a
  seek — Postgres walks and discards every preceding index entry. The index was never the problem;
  the access pattern was. The fix (keyset pagination) costs you the ability to jump to an arbitrary
  page number, which is a product decision, not a free win.
- **Lifecycle tags** got *slower* in milliseconds and was still the right change. The old code pulled
  every customer's tag array into Python and counted in a dict. Server time was fine; 143,096 rows
  crossed the wire to produce four numbers. Optimising for the metric that looks good would have
  meant keeping the version that falls over first.

Each case in the app states its own trade-off — staleness for materialized views, approximation for
planner-estimate counts, and the fact that the trigram index does *not* help a common search term
with `LIMIT 20`, because a sequential scan exits early.

### Loading the data

`scripts_load_scale.py` bulk-loads via `COPY FROM STDIN`, drops the secondary indexes on `orders`
first and rebuilds them after, reconciles customer aggregates with one set-based `UPDATE … FROM`
(replacing an O(n²) per-customer Python loop), and runs `ANALYZE` so the planner has real statistics.

It also enforces a **storage budget**, checking `pg_database_size()` after every batch and stopping
early rather than pushing a free-tier Neon branch into a read-only state. The database currently
sits at 480 MB against a 0.5 GB limit, which is why `orders.items` is null for bulk rows and why the
partitioning work below is described rather than deployed.

---

## 2. One definition per metric

This project previously displayed **three different revenue figures on three different screens** —
₹111.4M, ₹74.8M and ₹56.7M. None were arithmetically wrong. Each answered a different question, and
none of them said which:

| Screen | Was computing |
|--------|---------------|
| Dashboard | `SUM(amount)` over **all** orders, including returned and cancelled |
| Customer stats | `SUM(customers.total_spent)` |
| Analytics | `SUM(amount)` over completed orders, last 12 months only |

`app/metrics.py` is now the single source of truth. Every metric carries its own definition string,
and the API ships that definition alongside the value so the UI can show a reader exactly what a
number means.

The same file fixed a **0% open rate** that the dashboard had been displaying. Campaign counters
(`campaigns.total_opened`) were never updated by the webhook path and sat at zero while the
underlying events existed. Metrics are now derived from the `communications` event table instead —
and because delivery states are monotonic, a message that reached `clicked` is correctly counted as
delivered and opened. The real open rate is 69.2%.

---

## 3. The analysis: knowing when to say no

[/analysis](https://thread-co-beige.vercel.app/analysis) answers "how is our retention trending?"

The cohort query is correct and the matrix renders cleanly. It shows retention between **21.1% and
25.6% across 66 cohort-months, standard deviation 0.86 points, with no decay from month 1 to month
6.** Flat retention is not a behaviour that occurs in retail. It is the signature of a generator
assigning order dates uniformly at random.

So the finding is: **this dataset cannot support retention, churn-timing or win-back-window
conclusions.** Two of three data-quality checks fail; the failures are reported as failures.

That conclusion was then tested a second way. `app/ml_churn_prediction.py` trains a random forest to
predict whether a customer orders again in a 90-day window, with features computed strictly *before*
the cutoff and the label strictly *after* it. It scores **ROC-AUC 0.502** — chance. Two independent
methods, same answer.

> An earlier version of that script defined churn as `recency_days > 90` and then fed
> `recency_days` to the classifier. That scores near-perfect AUC and means nothing — it reads the
> answer off the label's own definition. The rewrite guards against it explicitly, and the script
> flags an implausibly high AUC as a leakage warning rather than a success.

What the data *can* support is segment value: revenue concentration passed the audit (top decile =
22.5% of revenue), because it emerges from the basket-size distribution rather than being imposed.
So the one recommendation the app makes is a high-value win-back segment — with an explicit note that
the 45-day threshold is a business convention, not a finding, and that on production data you would
derive it from the observed survival curve.

---

## 4. The SQL console

[/workbench](https://thread-co-beige.vercel.app/workbench) lets you type your own SQL against the
live dataset. That is the most dangerous thing you can put on a public URL, so it is layered — each
layer assuming the ones above it have been bypassed:

1. **A Postgres role with `SELECT` and nothing else.** This is the layer that actually matters.
2. **Session defaults set via `ALTER ROLE`** — `default_transaction_read_only`, a 4s
   `statement_timeout`, a 10s idle-in-transaction timeout. Set on the role, so application code
   cannot forget them.
3. **An explicit `READ ONLY` transaction** per request.
4. **Statement-shape checks** — single statement, must start with `SELECT`/`WITH`/`TABLE`/`EXPLAIN`.
5. **Denied surface** — system catalogs, filesystem functions, `pg_sleep`.
6. **Output caps** on rows and cell width.

The layering is not decorative. `WITH x AS (DELETE FROM customers RETURNING *) SELECT * FROM x`
**passes** the string checks in step 4 — it starts with `WITH` — and is refused by the role in step 1.
Setup lives in `xeno-crm-backend/SETUP_READONLY_ROLE.sql`; if `DATABASE_URL_READONLY` is unset the
console disables itself rather than falling back to the owner role.

---

## 5. Architecture

```text
┌─────────────┐      ┌───────────────┐      ┌──────────────────┐
│   React     │─────▶│  FastAPI      │─────▶│  Neon Postgres   │
│  (Vercel)   │      │  (Render)     │      │  1.01M orders    │
└─────────────┘      └───────┬───────┘      └──────────────────┘
                             │                        ▲
                             │  read-only role        │
                             ▼                        │
                     ┌───────────────┐        ┌───────────────┐
                     │ SQL console + │        │ Materialized  │
                     │ Perf Lab      │        │ rollups (×3)  │
                     └───────────────┘        └───────────────┘
                             │
                             ▼
                     ┌───────────────┐
                     │ Channel sim   │ async callbacks → webhook ingestor
                     └───────────────┘
```

Three materialized views (`mv_revenue_monthly`, `mv_city_revenue`, `mv_cohort_retention`) back the
dashboard. Each has a unique index so `REFRESH … CONCURRENTLY` can keep them readable while
rebuilding; `scripts_refresh_rollups.py` runs the refresh (~0.9s, ~1.2s and ~2.4s respectively).

**Idempotency and ordering** in the callback loop are unchanged from the original design: receipts
deduplicate on `(campaign_id, customer_id, event_type)`, and a `STATUS_ORDER` map prevents a late
`delivered` callback from regressing a message already marked `clicked`.

For scaling limits, the partitioning analysis, and what would move to a columnar warehouse, see
[SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).

---

## 6. Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TailwindCSS, Framer Motion, Recharts |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic |
| Database | Neon Serverless Postgres 18 (`pg_trgm`, materialized views) |
| ML | scikit-learn (random forest, offline — see `requirements-ml.txt`) |
| LLM | NVIDIA NIM, `nvidia/llama-3.1-nemotron-ultra-253b-v1` |
| Deployment | Render (API), Vercel (frontend) |

`requirements-ml.txt` is deliberately separate: the API never imports pandas or scikit-learn, and
adding ~200 MB of scientific Python to every deploy would slow builds and cold starts for code that
runs offline.

---

## 7. Running it locally

```bash
# Backend
cd xeno-crm-backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in DATABASE_URL and DATABASE_URL_READONLY
psql "$DATABASE_URL" -f SETUP_READONLY_ROLE.sql
uvicorn app.main:app --reload

# Frontend
cd xeno-crm-frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

Optional, against your own database:

```bash
python scripts_load_scale.py --orders 1000000 --customers 120000 --budget-mb 400
python scripts_refresh_rollups.py
pip install -r requirements-ml.txt && python -m app.ml_churn_prediction
```

---

## 8. Scope

Built: the analytics and query-performance layer, AI segment compilation, and the two-service
delivery callback loop. **Not** built: authentication, billing, multi-tenant RBAC. Those are table
stakes for a production CRM and would not have shown anything this project is trying to show.

Delivery and engagement events are produced by the channel simulator. They are real state
transitions through the real webhook pipeline, but they are not real customer behaviour, and the app
labels them as such rather than reporting them as campaign lift.

Deployed on free tiers: the Render instance sleeps after inactivity, so the first request can take
~30s to wake.
