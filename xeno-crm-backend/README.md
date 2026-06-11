# Xeno CRM Backend

AI-native Mini CRM backend for **ThreadCo** — a fashion brand reaching its shoppers through intelligent, personalised campaigns.

## Architecture

Two-service design:
- **CRM Backend** (this service) — FastAPI + PostgreSQL
- **Channel Stub Service** (separate) — simulates message delivery with async callbacks

## Setup

```bash
# 1. Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up your environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials and Anthropic API key

# 4. Start the server
uvicorn app.main:app --reload --port 8000

# 5. Seed the database (after PostgreSQL is running)
python -m app.seed
```

## Data Model

| Model | Purpose |
|---|---|
| Customer | Shoppers with demographics, spend history, and tags |
| Order | Purchase history with items, amounts, and channels |
| Segment | Audience slices defined by filter rules or natural language |
| Campaign | Outreach to a segment via a messaging channel |
| Communication | Individual message to a customer within a campaign |

## Tech Stack

- **FastAPI** — async Python web framework
- **PostgreSQL** — relational data store
- **SQLAlchemy** — ORM
- **Anthropic Claude** — AI for natural language segmentation and message generation
- **httpx** — async HTTP client for channel stub communication
