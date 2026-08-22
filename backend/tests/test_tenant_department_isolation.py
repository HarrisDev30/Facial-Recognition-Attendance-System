import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.organization import OrgType, Organization


@pytest.mark.asyncio
async def test_tenant_department_isolation_between_institutions(test_session):
    """Verify that querying departments for Institution A NEVER returns Institution B's departments."""
    # 1. Create Institution A (CJC) with CCIS and COE colleges
    inst_a = Institution(name="Cor Jesu College", code=f"cjc_iso_{uuid.uuid4().hex[:6]}")
    test_session.add(inst_a)
    await test_session.flush()

    org_a1 = Organization(
        institution_id=inst_a.id,
        name="CJC College of Computing",
        code="CCIS",
        org_type=OrgType.COLLEGE,
    )
    org_a_club = Organization(
        institution_id=inst_a.id,
        name="CJC Chess Club",
        code="CHESS",
        org_type=OrgType.CLUB,
    )
    test_session.add_all([org_a1, org_a_club])

    # 2. Create Institution B (AdDU) with CS and Nursing colleges
    inst_b = Institution(name="Ateneo de Davao University", code=f"addu_iso_{uuid.uuid4().hex[:6]}")
    test_session.add(inst_b)
    await test_session.flush()

    org_b1 = Organization(
        institution_id=inst_b.id,
        name="AdDU Computer Science Department",
        code="CS_DEPT",
        org_type=OrgType.COLLEGE,
    )
    test_session.add(org_b1)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 3. Query CJC with org_type=college
        resp_a = await ac.get(f"/api/departments?institution_slug={inst_a.code}&org_type=college")
        assert resp_a.status_code == 200
        data_a = resp_a.json()
        names_a = [d["name"] for d in data_a["items"]]
        assert "CJC College of Computing" in names_a
        assert "CJC Chess Club" not in names_a  # Excluded clubs
        assert "AdDU Computer Science Department" not in names_a  # No leakage from AdDU

        # 4. Query AdDU with org_type=college
        resp_b = await ac.get(f"/api/departments?institution_slug={inst_b.code}&org_type=college")
        assert resp_b.status_code == 200
        data_b = resp_b.json()
        names_b = [d["name"] for d in data_b["items"]]
        assert "AdDU Computer Science Department" in names_b
        assert "CJC College of Computing" not in names_b  # No leakage from CJC
