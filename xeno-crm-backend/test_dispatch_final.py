import requests
import time

base_url = "http://localhost:8000/api"

print("Fetching segments...")
segs = requests.get(f"{base_url}/segments").json()
seg_id = segs[0]["id"]

print("Creating campaign...")
camp = requests.post(f"{base_url}/campaigns", json={
    "name": "Final Async Test",
    "segment_id": seg_id,
    "channel": "whatsapp",
    "message_template": "Hello {{name}}!"
}).json()
camp_id = camp["id"]

print(f"Created campaign {camp_id}")
print("Dispatching...")
res = requests.post(f"{base_url}/campaigns/{camp_id}/dispatch")
print(f"Dispatch status: {res.status_code}")
print(f"Dispatch result: {res.json()}")

print("Waiting 40 seconds for background webhooks to process...")
for i in range(40):
    time.sleep(1)
    if i % 10 == 0:
        print(f"Waited {i} seconds...")
        print(requests.get(f"{base_url}/campaigns/{camp_id}/performance").json())

print("Final performance stats:")
print(requests.get(f"{base_url}/campaigns/{camp_id}/performance").json())
