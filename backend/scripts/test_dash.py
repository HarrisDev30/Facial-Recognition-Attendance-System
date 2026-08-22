import requests

base = "http://localhost:8000"

resp = requests.post(f"{base}/api/auth/login", json={"email": "admin@gmail.com", "password": "admin123!"})
data = resp.json()
print("Login keys:", data.keys())
token = data["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("GET /api/events:", requests.get(f"{base}/api/events", headers=headers).status_code)
print("GET /api/attendees:", requests.get(f"{base}/api/attendees", headers=headers).status_code)
print("GET /api/events/upcoming:", requests.get(f"{base}/api/events/upcoming", headers=headers).status_code)
print("GET /api/organizations:", requests.get(f"{base}/api/organizations", headers=headers).status_code)
