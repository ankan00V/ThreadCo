import requests
import time

base_url = "http://localhost:8000"

# Get a segment
segs = requests.get(f"{base_url}/api/segments").json()
if not segs:
    print("No segments found")
    exit(1)
seg_id = segs[0]["id"]

# Create a campaign
camp = requests.post(f"{base_url}/api/campaigns", json={
    "name": "Test Campaign",
    "segment_id": seg_id,
    "channel": "whatsapp",
    "message_template": "Hi {{name}}!"
}).json()
camp_id = camp["id"]
print(f"Created campaign {camp_id}")

# Dispatch
res = requests.post(f"{base_url}/api/campaigns/{camp_id}/dispatch")
print(f"Dispatch status: {res.status_code}")

print("Waiting 10 seconds for webhooks to process...")
time.sleep(10)

# Check performance
perf = requests.get(f"{base_url}/api/campaigns/{camp_id}/performance").json()
print(perf)
