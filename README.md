# ThreadCo CRM

ThreadCo is a full-stack, high-performance Mini CRM designed specifically for modern D2C (Direct-to-Consumer) brands. It enables marketing teams to effortlessly ingest data, segment their audience dynamically, design campaigns, and trigger highly personalized AI-driven communications.

## 🚀 Key Features

- **Data Ingestion APIs:** Robust endpoints to securely ingest Customer and Order data into a highly normalized relational database.
- **Dynamic Audience Segmentation:** A powerful rule-engine that filters users based on real-time database metrics (e.g., total spend, number of visits, last visit date).
- **Campaign Management:** An intuitive interface to create campaigns, apply specific audience segments, and dispatch messages to targeted user bases.
- **Generative AI Messaging:** Instead of static templates, ThreadCo integrates with **Nvidia NIM (Llama 3)** to dynamically generate highly personalized, engaging messages tailored to the specific context of each campaign audience.
- **Delivery Webhook Simulation:** A fast, asynchronous webhook architecture that simulates the message delivery lifecycle (QUEUED -> SENT -> DELIVERED/FAILED) in real-time to track vendor statuses.
- **Interactive Analytics:** A beautifully crafted, responsive dashboard built with Recharts to visualize campaign performance, message delivery success rates, and customer growth over time.
- **Modern, Responsive UI:** A sleek, premium frontend experience that works seamlessly across desktop, tablet, and mobile devices.

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
