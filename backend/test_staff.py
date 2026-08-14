import requests

base = "http://localhost:8000"

resp = requests.post(f"{base}/api/auth/login", json={"email": "harrisasani@g.cjc.edu.ph", "password": "Password123!"})
print("Login status:", resp.status_code)
data = resp.json()
print("User profile:", data.get("user"))

token = data.get("access_token")
if token:
    headers = {"Authorization": f"Bearer {token}"}
    orgs = requests.get(f"{base}/api/organizations", headers=headers).json()
    print("Scoped Organizations for Harris:", [o["name"] for o in orgs])
