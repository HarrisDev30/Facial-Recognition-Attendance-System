import asyncio
import httpx
from app.main import app
from app.services.auth_service import create_access_token
from app.models.user import UserRole

async def test_endpoint():
    token = create_access_token({
        "sub": "00000000-0000-0000-0000-000000000000",
        "email": "superadmin@attendify.edu",
        "role": UserRole.super_admin.value,
        "institution_id": None,
    })
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/super-admin/institutions", headers={"Authorization": f"Bearer {token}"})
        print(f"Status: {res.status_code}")
        print(f"Body: {res.text}")

if __name__ == "__main__":
    asyncio.run(test_endpoint())
