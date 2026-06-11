# Xeno CRM: System Design & Architecture

This document outlines the architectural decisions, scaling constraints, and AI-native development workflows utilized in building the Xeno Mini CRM.

## 1. Technology Stack

* **Frontend:** React + Vite + TailwindCSS + Recharts
* **Backend:** Python FastAPI + SQLAlchemy ORM
* **Database:** Neon Postgres (Serverless PostgreSQL)
* **AI Inference:** Nvidia NIM API (LLM inference)
* **Delivery:** Stubbed FastAPI router simulating channel providers (WhatsApp, SMS, Email, RCS)

## 2. Architecture Diagram

The application follows an asynchronous event-driven architecture to ensure the core CRM remains highly responsive while orchestrating third-party message delivery.

```text
+----------------+       +-------------------+       +-----------------------+
|                | (1)   |                   | (2)   |                       |
|  React Client  | ----> |  FastAPI CRM API  | ----> |  Channel Stub Router  |
|   (Frontend)   |       |  (Orchestrator)   | POST  |  (Provider Mock)      |
|                |       |                   |       |                       |
+----------------+       +-------------------+       +-----------------------+
        ^                          |                             |
        | (5)                      | (4)                         | (3)
        | GET /stats               v                             v
+----------------+       +-------------------+       +-----------------------+
|                |       |                   |       |                       |
|   Dashboard    | <---- |  Neon Postgres    | <---- |   Webhook Ingestor    |
|   UI Metrics   |       |  (Database)       | POST  |   (Event Consumer)    |
|                |       |                   |       |                       |
+----------------+       +-------------------+       +-----------------------+
```

## 3. Component Details & Design Choices

### The Channel Stub
The channel stub is a separate FastAPI router exposing a clean HTTP interface. In production, this would be extracted into a standalone microservice or serverless function. For this scope, it lives in-process but is architecturally isolated. It accepts a dispatch payload, immediately returns a `202 Accepted`, and uses `asyncio` to simulate the full lifecycle of a message (Delivered → Opened → Clicked → Converted).

### Database: Neon Postgres
We opted for Neon Postgres (serverless PostgreSQL) mapped via SQLAlchemy. 
**Why not SQLite?** Neon provides real-world Postgres semantics, connection pooling, and ACID guarantees that mirror production CRM workloads. While SQLite is suitable for prototyping, a CRM demands robust concurrent writes—especially when handling high-frequency webhook receipts.

### The Callback Loop & State Machine
* **Async Simulation:** We utilize FastAPI `BackgroundTasks` / `asyncio` to drive the asynchronous simulation of user actions.
* **Idempotency:** Webhook receipts are strictly idempotent. The ingestor checks for existing events in the JSON array (`events_json`) and deduplicates based on the composite key of `(campaign_id, customer_id, event_type)`.
* **State Progression:** The database model adheres to a strict state ordering dictionary (`STATUS_ORDER`). A communication cannot regress from `converted` back to `delivered`, ensuring monotonic state transitions even if webhooks arrive out-of-order due to network latency.

## 4. Scalability Assumptions & Limits

The current architecture is optimized for the take-home assignment scope:
* **Current Capacity:** ~1,500 active customers.
* **Throughput:** ~10,000 messages/hour peak. 
* **Current Bottleneck:** Async `httpx` gather limits (currently throttled via an `asyncio.Semaphore(20)`).

Neon Postgres easily handles this volume of concurrent webhook writes. However, at **1M+ customers**, the architecture would evolve:
1. **Message Queue:** Introduce **Celery + Redis** (or Kafka) to buffer outgoing dispatch requests and incoming webhook receipts.
2. **Caching:** Cache segment definitions and compiled queries in Redis to prevent heavy reads on dispatch.
3. **Microservices:** Physically decouple the Channel Stub and Webhook Ingestor into distinct containers with independent auto-scaling policies.

## 5. AI-Native Development Workflow

The creation of this CRM heavily leveraged an AI-native workflow, treating the LLM as an autonomous pair programmer rather than a mere autocomplete tool.

* **Nvidia NIM API:** We strictly utilized the Nvidia NIM API for LLM inference (not OpenAI), demonstrating flexibility in adopting open-source or proprietary models via Nvidia's optimized runtime.
* **Scaffolding vs. Hardening:** The AI was utilized to rapidly scaffold the channel state machine, async simulation loops, and retry logic. However, critical domain logic—such as the idempotency logic and the strict status ordering (`STATUS_ORDER` dict)—was manually reviewed, tested, and hardened.
* **Algorithmic Drafting:** The AI drafted the initial RFM (Recency, Frequency, Monetary) tagging algorithm inside `seed.py`. We subsequently tuned the dollar and recency thresholds manually based on realistic D2C industry benchmarks to ensure realistic data distributions.
* **UI/UX Polish:** The AI generated the Recharts configurations and the Tailwind CSS engagement funnel. We then manually adjusted the color palettes, micro-animations, and transition timings to achieve a premium, modern aesthetic.
