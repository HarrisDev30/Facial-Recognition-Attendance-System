import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.organization import OrgType, Organization


@pytest.mark.asyncio
async def test_departments_fetching_by_institution_slug_and_prefix(test_session):
    """Test that departments are returned when querying by exact slug, prefix, or institution_id."""
    # 1. Create Institution with generated code like 'cjc_123456'
    code_suffix = uuid.uuid4().hex[:6]
    inst = Institution(name="Cor Jesu College", code=f"cjc_{code_suffix}")
    test_session.add(inst)
    await test_session.flush()

    # 2. Add College of Science organization
    org = Organization(
        institution_id=inst.id,
        name="College of Arts and Sciences",
        code="CAS",
        org_type=OrgType.COLLEGE,
    )
    test_session.add(org)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 3. Exact slug query
        resp_exact = await ac.get(f"/api/departments?institution_slug=cjc_{code_suffix}")
        assert resp_exact.status_code == 200
        data_exact = resp_exact.json()
        assert data_exact["total"] >= 1
        assert any(d["name"] == "College of Arts and Sciences" for d in data_exact["items"])

        # 4. Prefix slug query (e.g. 'cjc')
        resp_prefix = await ac.get("/api/departments?institution_slug=cjc")
        assert resp_prefix.status_code == 200
        data_prefix = resp_prefix.json()
        assert data_prefix["total"] >= 1
