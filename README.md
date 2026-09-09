# ThreadCo — customer engagement at retail scale

**Live:** https://thread-co-beige.vercel.app · **API:** https://threadco-api.onrender.com/health

## Why this exists

A retailer with tens of thousands of customers wants to run a campaign. The hard part is not the
send button — it is that at that size, everything around the send button stops working:

- Resolving "high-value customers who haven't ordered in 45 days" scans the customer table.
- Creating one delivery record per recipient, one row at a time, takes longer than any request timeout.
- Tracking what happened to each message means aggregating hundreds of thousands of events on every
  dashboard load.
- And the marketer still has to trust the open rate they are shown.

None of that is visible at 1,500 customers. All of it bites at 80,000. **This project is about the
part that bites** — the query performance, the dispatch throughput, and the metric definitions that
decide whether anyone can act on the result.

| Page | What it shows |
|------|---------------|
| **[/workbench](https://thread-co-beige.vercel.app/workbench)** — Query Performance Lab | Six queries run live, the slow way and the fast way, reporting PostgreSQL's own execution time. Plus a SQL console you can type into. |
| **[/analysis](https://thread-co-beige.vercel.app/analysis)** — Written analysis | A data-quality audit that once failed, why it failed, and what changed. |
| **[/analytics](https://thread-co-beige.vercel.app/analytics)** | Business metrics, each carrying its own definition. |

**Working set:** 537,965 orders · 80,000 customers · Neon Postgres, 408 MB of a 512 MB free branch.

---

## 1. Query performance at scale

Every "before" below is a pattern that was genuinely in this codebase when the database held 1,500
customers, where all of them ran in single-digit milliseconds. Measurements are PostgreSQL's
`Execution Time` from `EXPLAIN (ANALYZE, BUFFERS)` — not wall clock, which on a serverless database
mostly measures the network round trip.

| Case | Before | After | Change |
|------|-------:|------:|--------|
| Deep pagination (`OFFSET` ~484k) | 514 ms | 0.10 ms | **~5,200×** |
| Monthly revenue rollup | 295 ms | 0.04 ms | ~6,700× |
| Pagination total (`COUNT(*)`) | 13 ms | 0.04 ms | ~320× |
| Customer text search (`ILIKE '%…%'`) | 51 ms | 4 ms | ~13× |
| Revenue by city (unnecessary join) | 361 ms | 184 ms | ~2× |
| Lifecycle tags (aggregate in app) | 25 ms | 82 ms | **slower** — but 79k rows → 4 |

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

### Dispatching to a large segment

The original dispatch endpoint resolved the segment into full ORM objects, called `db.add()` once
per recipient, then held the HTTP connection open until every message had been sent. Against a few
hundred recipients that is fine. Against a large segment it does not get slow — it fails, because no
request survives long enough to finish.

The rewrite:

- **Resolves only the columns dispatch needs** (`id`, `name`, `email`, `phone`) instead of hydrating
  a Customer object per recipient.
- **Bulk-inserts communications per 2,000-recipient chunk** rather than one ORM `add()` per row.
- **Bounds outbound concurrency at 40.** Real providers rate-limit; unbounded fan-out gets you
  throttled, not fast.
- **Returns immediately and delivers in the background.** The response confirms acceptance, not
  completion — progress is read from the communications event table.

Measured: 5,000 recipients queued and the request returned in **2.4s**, with segment resolution
taking 502 ms of that. All 5,000 delivered.

`MAX_RECIPIENTS_PER_DISPATCH` caps a single send at 5,000. Each communication row costs roughly 1 KB
with its event history, so an uncapped send would exhaust the free-tier database mid-campaign and
leave it read-only. It is a resource guard, not a design limit.


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

## 3. The analysis: a check that actually failed

[/analysis](https://thread-co-beige.vercel.app/analysis) runs three data-quality checks live, each
with a stated threshold. All three pass now. **Two of them failed on the first version of the
dataset, and that is why they exist.**

The cohort query came back showing retention between 21% and 26% in every cohort-month, with a
standard deviation of **0.86 points** and no decay from month 1 to month 6. Flat retention is not a
behaviour that occurs in retail — it is the signature of a generator assigning order dates uniformly
at random, independent of the customer. Average order value was also identical across channels to
within 0.27%, for the same reason.

The diagnosis was confirmed independently: a churn model built on that data, with features computed
strictly before the cutoff and the label strictly after, scored **ROC-AUC 0.502** — chance. Past
purchasing carried no information about future purchasing, exactly as the retention curve implied.

So the generator was rewritten to model behaviour rather than noise — per-customer purchase
intensity, exponential inter-purchase intervals, exponential customer lifetimes so most customers
lapse early, basket size conditioned on channel, and festive-season seasonality. After the rebuild:

| | Before | After |
|---|---|---|
| Month-1 → month-6 retention | 23% → 23% (flat) | 47% → 18% (decays) |
| AOV by channel | identical to 0.27% | in-store ₹4,596 vs online ₹2,900 |
| Top decile share of revenue | 22.5% | 53.7% |
| Churn model ROC-AUC | **0.502** (chance) | **0.944** |
| Dominant churn feature | none | `recency_days` (0.744) |

Recency dominating is the result RFM theory predicts, which is the point: the model is not just
scoring higher, it is scoring higher *for the right reason*.

> **The honest caveat, which the app also states:** 0.944 is higher than a real retail churn model
> would score. The generator's churn process is cleaner than reality, where lapsing is noisier and
> partly unobservable. It is evidence the pipeline is sound, not a production accuracy claim.

> An earlier version of that script defined churn as `recency_days > 90` and then fed `recency_days`
> to the classifier. That scores near-perfect AUC and means nothing — it reads the answer off the
> label's own definition. The rewrite guards against it explicitly, and flags an implausibly high
> AUC as a leakage warning rather than a success.

---

## 4. The sandbox — the part with actual users

[/workbench](https://thread-co-beige.vercel.app/workbench) is not a screenshot. It is a working
Postgres performance sandbox on a realistic retail schema, which is the thing most SQL tutorials
cannot offer: they teach indexing on hundred-row toy tables, where every plan is a sequential scan
and every query is instant.

- **Six case studies** run live, the slow way and the fast way, reporting PostgreSQL's own
  `Execution Time` rather than wall clock.
- **Three challenges** where you write the faster query and it is scored against the reference.
  Each has its own pass bar — removing an unnecessary join caps out near 1.5×, while swapping
  `OFFSET` for a keyset seek is four orders of magnitude, and holding both to one threshold would
  make the correct answer to one of them unwinnable. A submission only counts if it returns the
  same number of rows, so a query that is fast because it answers something easier does not score.
- **A schema browser** reading the live catalog: tables, row counts, column types, and every index
  with its size and definition. You cannot reason about why a plan did or did not use an index
  without it.
- **Plan diagnostics in plain English** (`app/plan_explain.py`). `EXPLAIN` tells you what the
  planner did; these rules tell you which part is the problem — sequential scans over large tables,
  sorts spilling to disk, planner estimates off by 10× or more, nested loops running their inner
  side thousands of times, `OFFSET` discarding rows it just produced. Deliberately rule-based
  rather than an LLM: the diagnosis has to be reproducible, and every rule maps to a documented
  Postgres behaviour.

### Why the console is safe to leave open

Letting strangers run SQL against a live database is the most dangerous thing on this site, so it
is layered — each layer assuming the ones above it have been bypassed:

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

### Cold starts on a free tier

Render's free tier sleeps after ~15 minutes idle and takes ~50s to wake. The obvious fix — a GitHub
Actions `*/5` cron — **does not work**, and this repo's run history shows why: GitHub throttles
scheduled workflows onto a best-effort queue, and the 5-minute schedule actually fired every **121 to
277 minutes**.

Pinging continuously would work, and it is the wrong trade. Render allows 750 instance-hours a month
against a ~730-hour month, so staying awake consumes essentially the whole allowance — and once it
runs out the service stops answering entirely, which is a far worse failure than a slow first load.

So the cold start is handled in the product rather than papered over:

- **`warmBackend()`** (`src/api.js`) fires `/healthz` as the bundle loads, before React renders, so
  the instance wakes while the visitor is still reading the page rather than after their first click.
- **The loading state counts down** against Render's stated ~50s wake time, names the stage it is in,
  and says so plainly if it overruns instead of spinning silently.
- **`.github/workflows/keep-render-awake.yml`** is manual-only. Trigger it from the Actions tab a few
  minutes before sharing the link and it pings for 30 minutes, so a scheduled demo lands warm.
