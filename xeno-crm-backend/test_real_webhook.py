import requests
from app.database import engine
from sqlalchemy import text
from datetime import datetime, timezone

with engine.connect() as c:
    row = c.execute(text("SELECT campaign_id, customer_id FROM communications LIMIT 1")).fetchone()
    
if not row:
    print("No communications found")
    exit(1)

camp_id = str(row[0])
cust_id = str(row[1])
print(f"Using campaign={camp_id}, customer={cust_id}")

res = requests.post("http://localhost:8000/webhooks/receipt", json={
    "campaign_id": camp_id,
    "customer_id": cust_id,
    "event_type": "delivered",
    "timestamp": datetime.now(timezone.utc).isoformat()
})

print(res.status_code)
print(res.text)
