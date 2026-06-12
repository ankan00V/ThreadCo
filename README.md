# ThreadCo CRM (Xeno Mini CRM Assignment)

ThreadCo is a full-stack, high-performance Mini CRM built as a submission for the Xeno engineering assignment. It is designed specifically for modern D2C (Direct-to-Consumer) brands to effortlessly segment their audience, design campaigns, and trigger highly personalized AI-driven communications.

## 🎯 The Assignment (What Was Asked)

The objective was to build a Mini CRM system focused on segmenting audiences and dispatching campaigns. Key requirements included:
- **Data Ingestion:** APIs to ingest Customer data and Order data into a relational database.
- **Audience Segmentation:** Ability to create dynamic audience segments based on rules (e.g., total spend, number of visits, last visit date).
- **Campaign Management:** A feature to create campaigns, apply a specific segment, and send personalized messages to that audience.
- **Message Vendor Integration:** Integration with a simulated vendor API to track message delivery statuses asynchronously (e.g., SENT, FAILED, DELIVERED).
- **Delivery Analytics:** A way to track and visualize the success of the campaigns.

## 🚀 The Solution (What We Delivered)

We delivered **ThreadCo**, a production-ready, beautifully designed SaaS application that exceeds the baseline requirements by focusing on scale, user experience, and generative AI.

### Key Features Delivered
1. **Dynamic Audience Segmentation:** A robust rule-engine that filters users based on real-time database queries (e.g., Spend > $10K AND Visits < 3).
2. **Generative AI Messaging:** Instead of static templates, ThreadCo integrates with **Nvidia NIM (Llama 3)** to dynamically generate highly personalized, engaging messages tailored to the specific campaign audience.
3. **Robust Delivery Simulation:** A fast, asynchronous webhook architecture that simulates the message lifecycle (QUEUED -> SENT -> DELIVERED/FAILED -> READ) in real-time.
4. **Interactive Analytics:** A beautifully crafted, responsive dashboard built with Recharts to visualize campaign performance, message delivery statuses, and customer growth over time.
5. **Modern, Responsive UI:** A sleek, premium frontend experience that works seamlessly across desktop, tablet, and mobile devices.

## 💻 Tech Stack

- **Frontend:** React, Vite, TailwindCSS, Framer Motion, Recharts, React Router
- **Backend:** Python, FastAPI, SQLAlchemy, Pydantic
- **Database:** PostgreSQL (Neon Serverless Postgres)
- **AI Engine:** Nvidia NIM API (Llama 3)

## 🛠️ Getting Started

### Backend Setup
1. Navigate to the backend directory: `cd xeno-crm-backend`
2. Create a virtual environment: `python3 -m venv venv && source venv/bin/activate`
3. Install dependencies: `pip install -r requirements.txt`
4. Set up your `.env` file with `DATABASE_URL` and `NVIDIA_NIM_API_KEY`.
5. Run the server: `uvicorn main:app --reload`
*(The app will automatically seed the database with mock customers and orders if it's empty).*

### Frontend Setup
1. Navigate to the frontend directory: `cd xeno-crm-frontend`
2. Install dependencies: `npm install`
3. Set your `VITE_API_URL` to point to the backend in a `.env` file (if not running on standard localhost ports).
4. Start the development server: `npm run dev`

---

For deep architectural decisions and data flow logic, please refer to the [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).
