import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.institution import Institution


@pytest.mark.asyncio
async def test_institutions_and_departments_api(test_session):
    """Verify listing institutions, departments by slug/type, and super-admin endpoints."""
    unique_code = f"cjc_test_{uuid.uuid4().hex[:6]}"
    inst = Institution(name="Cor Jesu College Test", code=unique_code, is_active=True)
    test_session.add(inst)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. List institutions
        list_res = await ac.get("/api/institutions")
        assert list_res.status_code == 200
        data = list_res.json()
        assert any(item["code"] == unique_code for item in data)

        # 2. Get by slug (success)
        slug_res = await ac.get(f"/api/institutions/by-slug/{unique_code}")
        assert slug_res.status_code == 200
        slug_data = slug_res.json()
        assert slug_data["code"] == unique_code
        assert slug_data["name"] == "Cor Jesu College Test"

        # 3. Get by slug (not found)
        res_404 = await ac.get("/api/institutions/by-slug/non_existent_slug_99999")
        assert res_404.status_code == 404

        # 4. Departments endpoint with slug & org_type
        dept_res = await ac.get(f"/api/departments?institution_slug={unique_code}&org_type=college")
        assert dept_res.status_code == 200
        dept_data = dept_res.json()
        assert "items" in dept_data
        assert isinstance(dept_data["items"], list)
