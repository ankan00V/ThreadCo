# Xeno Mini CRM

A high-performance, real-time CRM with generative AI messaging, designed for D2C brands.

## Tech Stack
- **Frontend:** React + Vite + TailwindCSS + Recharts
- **Backend:** Python FastAPI + SQLAlchemy + Neon Postgres (Serverless PostgreSQL)
- **AI Engine:** Nvidia NIM API (Llama-3 model)
- **Channel Stub:** Fast, simulated Webhook APIs for delivery, open, and click tracking

## 🤖 AI-Native Development Workflow

This application was engineered utilizing a highly collaborative "AI Pair Programming" workflow leveraging Google DeepMind's Antigravity framework.

### How AI Was Directed & Reviewed
- **Architectural Scaffolding:** AI drafted the initial FastAPI models and React configurations. The human architect reviewed the schemas to ensure database normalization rules were strictly adhered to (e.g., standardizing `id` fields to `UUIDs` globally).
- **Complex Logic Generation:** AI authored the complex SQL query required to compute dynamic RFM (Recency, Frequency, Monetary) tags. The human engineer tuned the threshold logic against real D2C retail benchmark assumptions.
- **State Machine Iterations:** We iterated on the webhook lifecycle multiple times. The AI proposed an initial `simulate_message_lifecycle` flow. We mutually audited the code to ensure strict idempotent status transitions (e.g., a "read" cannot regress to "queued"), which was crucial for maintaining data integrity in high-throughput webhook streams.

## Deployment Instructions

### Backend (Render / Railway)
1. Set the following environment variables:
   - `DATABASE_URL` (Neon Postgres Connection String)
   - `NVIDIA_NIM_API_KEY` (Nvidia NIM Access Key)
   - `FRONTEND_URL` (e.g. `https://xeno-crm-ui.vercel.app`)
2. FastAPI will automatically expose a `GET /health` endpoint for readiness probes.
3. During deployment, the application executes `seed.py` dynamically if the database is empty.

### Frontend (Vercel / Netlify)
1. Configure the `VITE_API_URL` to point to the backend URL.
2. Build via `npm run build` and serve statically.

For full architectural details, please see [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).
