# ThreadCo — AI-Native Mini CRM

**Live URL:** https://thread-co-beige.vercel.app  
**Backend Health:** https://threadco-api.onrender.com/health

ThreadCo is an AI-native customer-intelligence and campaign-orchestration demo for D2C brands. It helps marketers turn an ambiguous audience question into an analyzable segment, a measurable campaign, and a documented recommendation—without presenting simulated data as production lift.

> **Scope note:** I deliberately focused on the AI targeting engine, the two-service callback loop, and live campaign analytics. I chose **not** to build login/signup, billing, or multi-tenant RBAC — those are table stakes for a production CRM but outside the core value loop this assignment tests.

---

## 🎯 What It Does

1. **AI Audience Composer** — Marketers describe segments in plain English ("High-value customers in Delhi who haven't ordered in 30 days"). The LLM compiles this into SQL filter rules.
2. **Campaign Builder** — Select segment, channel (WhatsApp/SMS/Email/RCS), and message. AI can draft the copy.
3. **Live Delivery Tracker** — Watch messages move through the full lifecycle in real time: queued → sent → delivered → opened → read → clicked → converted (or failed).
4. **Data Intelligence Workbench** — Real completed-order trends, city-level customer value, lifecycle distributions, data-quality notes, and evidence-backed next actions.
5. **SQL Performance Diagnostic** — A safe, fixed, parameterized audience query exposes its PostgreSQL plan summary and relevant index path without allowing arbitrary browser-supplied SQL.

---

## 🏗️ Architecture

```text
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   React     │──────▶│  FastAPI CRM │──────▶│  Neon Postgres  │
│  (Vercel)   │      │  (Render)    │      │  (ACID/Serverless)│
└─────────────┘      └──────────────┘      └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Channel Router│ ◄── Simulates vendor API
                        │ (same service)│      (async callbacks, retries)
                        └──────────────┘
```

**Key design decisions:**
- **Neon Postgres** over SQLite — demonstrates production-grade ACID semantics and connection pooling.
- **Channel router in the CRM service** — keeps the demo deployable as one Render service while preserving the outbound-dispatch and asynchronous callback boundary.
- **Idempotency guard** — Receipts are deduplicated by `(campaign_id, customer_id, event_type)` so out-of-order or duplicate callbacks never corrupt state.
- **Status ordering** — A late "delivered" callback cannot regress a message already marked "clicked".
- **Query-aware data access** — composite and GIN indexes match directory, segment, recent-order, and campaign-status access paths; the analytics UI demonstrates a parameterized filter and its planner-selected strategy.

## 📊 Data-analysis evidence

- The development dataset contains **1,500 seeded customers** and completed-order history. Seeded data is explicitly labelled in the product and is never described as production customer activity.
- Customer Directory filtering and pagination execute on the server, rather than loading a fixed client-side sample.
- The Analytics view derives monthly revenue from completed orders and ranks cities by recorded customer spend. It does not use fabricated chart series.
- Recommendations connect an observable segment condition (for example, high-value and lapsed) to a measurable campaign next step. Simulated delivery events remain labelled as simulation.
- The query diagnostic uses a fixed parameterized statement and returns only a sanitized plan summary; it is not an arbitrary SQL console.

---

## 🧠 AI-Native Development Workflow

I used **Nvidia NIM API (Llama 3)** as a pair programmer, not a replacement. Specific integration points:

| Task | AI Role | My Review / Hardening |
|------|---------|----------------------|
| **Database schema** | Generated initial SQLAlchemy models | Tuned foreign keys, added `events_json` array for audit trail |
| **Callback state machine** | Drafted the event flow (queued → sent → delivered → opened → clicked → converted) | Added `STATUS_ORDER` dict to prevent status regression; added idempotency check |
| **Retry logic** | Suggested simple loop | Replaced with exponential backoff (2^n seconds, capped at 3 retries) |
| **RFM segmentation** | Drafted the algorithm | Tuned thresholds manually based on D2C benchmarks (₹10K high-value, 45-day lapsed) |
| **Recharts config** | Generated initial funnel chart | Rejected — animation timing was wrong; tuned `animationDuration` and `ease` manually |

**What I rejected:** The AI's first attempt at the campaign completion checker had a race condition (checked `queued == 0` before all rows were inserted). I fixed it by verifying `total_count == campaign.total_sent` before marking complete.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, TailwindCSS, Framer Motion, Recharts, React Router |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic, Uvicorn |
| Database | Neon Serverless Postgres (psycopg2-binary) |
| AI Engine | NVIDIA NIM API (`nvidia/nemotron-3-super-120b-a12b`) |
| Deployment | Render (backend), Vercel (frontend) |

---

## 🛠️ Local Development

```bash
# Backend
cd xeno-crm-backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Create .env with DATABASE_URL and NVIDIA_API_KEY
uvicorn app.main:app --reload  # seeds DB automatically if empty

# Frontend
cd xeno-crm-frontend
npm install
# Set VITE_API_URL=http://localhost:8000 in .env
npm run dev
```

📄 **System Design**

For deep architectural decisions, data flow diagrams, and scale assumptions, see [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).

---

## Render free-tier keep-warm setup

The backend exposes two operational endpoints:

- `/healthz` — process liveness only; used by the keep-warm workflow.
- `/health` — database readiness; use for deployment or diagnostic checks.

To enable the scheduled request, add a GitHub repository **Actions variable**
called `BACKEND_HEALTH_URL` with the exact deployed URL ending in `/healthz`,
for example `https://your-service.onrender.com/healthz`. The workflow at
`.github/workflows/keep-render-awake.yml` requests it every five minutes and
can also be run manually from the Actions tab.

This is suitable for a recruiter demo, not production availability: Render can
still restart free services, GitHub schedules can be delayed, and keeping one
service active continuously consumes almost all of Render's 750 free instance
hours in a 31-day month. Use a paid Render instance for a true always-on
backend.
