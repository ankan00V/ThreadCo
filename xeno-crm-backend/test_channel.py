from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

res = client.post("/channel/send", json={
    "campaign_id": "c53c35ca-e966-4e36-85e9-167dbba2d9fa",
    "customer_id": "c53c35ca-e966-4e36-85e9-167dbba2d9fa",
    "message": "test msg",
    "channel": "whatsapp",
    "external_id": "ext-1",
    "recipient": "rec"
})

print(res.status_code)
print(res.json())

# Wait a bit for background tasks
import time
time.sleep(3)
