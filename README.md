# ThreadCo — AI-Native Mini CRM

**Live URL:** https://thread-co-beige.vercel.app  
**Backend Health:** https://threadco-production.up.railway.app/health

ThreadCo is an AI-Native Mini CRM for D2C brands. It helps marketers decide **who** to talk to, **what** to say, and **how** to reach them — with a conversational AI interface and a realistic two-service message delivery simulation.

> **Scope note:** I deliberately focused on the AI targeting engine, the two-service callback loop, and live campaign analytics. I chose **not** to build login/signup, billing, or multi-tenant RBAC — those are table stakes for a production CRM but outside the core value loop this assignment tests.

---

## 🎯 What It Does

1. **AI Audience Composer** — Marketers describe segments in plain English ("High-value customers in Delhi who haven't ordered in 30 days"). The LLM compiles this into SQL filter rules.
2. **Campaign Builder** — Select segment, channel (WhatsApp/SMS/Email/RCS), and message. AI can draft the copy.
3. **Live Delivery Tracker** — Watch messages move through the full lifecycle in real time: queued → sent → delivered → opened → read → clicked → converted (or failed).
4. **Executive Dashboard** — Real-time gauges for customer base, campaign volume, and revenue attribution.

---

## 🏗️ Architecture

```text
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   React     │──────▶│  FastAPI CRM │──────▶│  Neon Postgres  │
│  (Vercel)   │      │  (Railway)   │      │  (ACID/Serverless)│
└─────────────┘      └──────────────┘      └─────────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ Channel Stub │  ◄── Simulates vendor API
                        │   (Router)   │      (async callbacks, retries)
                        └──────────────┘
```

**Key design decisions:**
- **Neon Postgres** over SQLite — demonstrates production-grade ACID semantics and connection pooling.
- **Channel Stub as a separate router** — mirrors real-world vendor integration. It simulates probabilistic outcomes (delivery, open, click, conversion, failure) and callbacks to the CRM receipt API with **exponential backoff retries**.
- **Idempotency guard** — Receipts are deduplicated by `(campaign_id, customer_id, event_type)` so out-of-order or duplicate callbacks never corrupt state.
- **Status ordering** — A late "delivered" callback cannot regress a message already marked "clicked".

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
| Frontend | React 18, Vite, TailwindCSS, Framer Motion, Recharts, React Router |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic, Uvicorn |
| Database | Neon Serverless Postgres (psycopg2-binary) |
| AI Engine | Nvidia NIM API (Llama 3) |
| Deployment | Railway (backend), Vercel (frontend) |

---

## 🛠️ Local Development

```bash
# Backend
cd xeno-crm-backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
# Create .env with DATABASE_URL and NVIDIA_NIM_API_KEY
uvicorn app.main:app --reload  # seeds DB automatically if empty

# Frontend
cd xeno-crm-frontend
npm install
# Set VITE_API_URL=http://localhost:8000 in .env
npm run dev
```

📄 **System Design**

For deep architectural decisions, data flow diagrams, and scale assumptions, see [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).
