from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

response = client.post("/webhooks/receipt", json={
    "campaign_id": "c53c35ca-e966-4e36-85e9-167dbba2d9fa",
    "customer_id": "c53c35ca-e966-4e36-85e9-167dbba2d9fa",
    "event_type": "delivered",
    "timestamp": "2026-06-10T19:07:33.442885+00:00"
})

print(response.status_code)
print(response.text)
