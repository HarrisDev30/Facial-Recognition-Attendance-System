import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.organization import OrgType, Organization
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_organization_creation_and_institution_scoping(test_session):
    """Test creating an organization/club with automatic institution_id binding and duplicate code rejection."""
    # 1. Create Institution and Admin User
    inst_cjc = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    test_session.add(inst_cjc)
    await test_session.flush()

    cjc_admin = User(
        email=f"cjc_admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash="mock_hash",
        role=UserRole.admin,
        institution_id=inst_cjc.id,
    )
    test_session.add(cjc_admin)
    await test_session.commit()

    token = create_access_token({
        "sub": str(cjc_admin.id),
        "email": cjc_admin.email,
        "role": cjc_admin.role.value,
        "institution_id": str(cjc_admin.institution_id),
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 2. Create Student Club (e.g. Math Club)
        create_resp = await ac.post(
            "/api/organizations",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "CJC Math Club",
                "code": "MATHCLUB",
                "org_type": "club",
                "description": "Mathematics and data science student society",
            },
        )
        assert create_resp.status_code == 201
        created_data = create_resp.json()
        assert created_data["name"] == "CJC Math Club"
        assert created_data["code"] == "MATHCLUB"
        assert created_data["org_type"] == "club"

        # 3. Attempt to create duplicate organization code in same institution -> MUST return 400 Bad Request
        dup_resp = await ac.post(
            "/api/organizations",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "Another Math Club",
                "code": "MATHCLUB",
                "org_type": "club",
                "description": "Duplicate club",
            },
        )
        assert dup_resp.status_code == 400
        assert "already exists" in dup_resp.json()["detail"]

        # 4. List organizations for CJC admin
        list_resp = await ac.get(
            "/api/organizations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_resp.status_code == 200
        orgs = list_resp.json()
        org_codes = [o["code"] for o in orgs]
        assert "MATHCLUB" in org_codes
