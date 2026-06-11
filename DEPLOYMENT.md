# Deployment Guide: Xeno CRM

This guide covers deploying the Xeno CRM backend to Render and the frontend to Vercel/Render, connecting to your existing Neon Postgres database.

## 1. Environment Variables

You will need to configure the following environment variables in your deployment environments:

### Backend (Render Web Service)
* `DATABASE_URL`: Your Neon Postgres connection string (e.g., `postgresql://user:pass@ep-lucky-dust.region.aws.neon.tech/neondb?sslmode=require`)
* `NVIDIA_NIM_API_KEY`: Your Nvidia NIM API key for AI generation.
* `FRONTEND_URL`: The deployed URL of your frontend (e.g., `https://xeno-crm-frontend.vercel.app`) to dynamically allow CORS.
* `CHANNEL_STUB_URL`: (Optional) Can point to itself `http://localhost:8000/channel` since it runs in the same process.

### Frontend (Vercel / Render Static)
* `VITE_API_URL`: The deployed URL of your FastAPI backend (e.g., `https://xeno-crm-backend.onrender.com`).

---

## 2. Deploying the Backend (FastAPI on Render.com)

1. Create a new **Web Service** on Render and connect your GitHub repository.
2. Ensure you select the backend folder as your **Root Directory** (e.g., `xeno-crm-backend`).
3. Settings:
   * **Environment:** Python
   * **Build Command:** `pip install -r requirements.txt` (or if using `uv`, run `uv pip install -r requirements.txt`)
   * **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. In the **Environment** tab, add your `DATABASE_URL`, `NVIDIA_NIM_API_KEY`, and `FRONTEND_URL`.
5. Click **Deploy**.

**Startup Auto-Seeding:**
During the startup lifespan event, the backend will ping the Neon Database using `SELECT 1`. If the connection is successful and the `customers` table is completely empty (count == 0), the app will automatically trigger `seed_data()` to safely pre-populate the database with realistic ThreadCo sample data.

---

## 3. Deploying the Frontend (React on Vercel)

1. Connect your repository to Vercel.
2. Set the **Framework Preset** to Vite.
3. If your frontend is inside a subdirectory (e.g., `xeno-crm-frontend`), set the **Root Directory** accordingly.
4. In **Environment Variables**, add `VITE_API_URL` pointing to your deployed Render backend.
5. Click **Deploy**.

---

## 4. Validating the Deployment

We have included a dedicated health check endpoint that tests connectivity to the database:

**`GET /health`**
```json
{
  "status": "ok",
  "service": "xeno-crm",
  "database": "connected"
}
```

If the Neon DB is unreachable or misconfigured, it will return:
```json
{
  "status": "error",
  "service": "xeno-crm",
  "database": "disconnected",
  "error": "<error message details>"
}
```

Visit `<your-backend-url>/health` to immediately verify your DB connection string is working!
