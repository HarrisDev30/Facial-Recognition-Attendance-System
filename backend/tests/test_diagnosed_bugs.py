import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.organization import OrgType, Organization
from app.models.scanner_device import ScannerDevice
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_organization_multi_tenant_isolation_and_performance(test_session):
    """Test that institution admin sees ONLY their own campus organizations without cross-tenant leakage."""
    # 1. Create CJC and AdDU Institutions
    inst_cjc = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    inst_addu = Institution(name="Ateneo de Davao University", code=f"addu_{uuid.uuid4().hex[:6]}")
    test_session.add(inst_cjc)
    test_session.add(inst_addu)
    await test_session.flush()

    # 2. Create CJC Math Club and AdDU CS Organization
    cjc_org = Organization(
        institution_id=inst_cjc.id,
        name="CJC Math Club",
        code=f"CJC_MATH_{uuid.uuid4().hex[:4]}",
        org_type=OrgType.CLUB,
    )
    addu_org = Organization(
        institution_id=inst_addu.id,
        name="AdDU Computer Science",
        code=f"ADDU_CS_{uuid.uuid4().hex[:4]}",
        org_type=OrgType.COLLEGE,
    )
    test_session.add(cjc_org)
    test_session.add(addu_org)

    # 3. Create CJC Admin User
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
        resp = await ac.get(
            "/api/organizations",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        orgs = resp.json()
        org_names = [o["name"] for o in orgs]
        assert "CJC Math Club" in org_names
        # Cross-tenant check: AdDU Computer Science MUST NOT appear in CJC admin's list!
        assert "AdDU Computer Science" not in org_names


@pytest.mark.asyncio
async def test_scanner_device_listing_for_institution_admin(test_session):
    """Test that CJC admin sees scanner devices bound to CJC."""
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

    device = ScannerDevice(
        institution_id=inst_cjc.id,
        name="CJC Gym Entrance Kiosk",
        device_type="dedicated_scanner",
        location="Gymnasium Entrance",
        is_active=True,
    )
    test_session.add(device)
    await test_session.commit()

    token = create_access_token({
        "sub": str(cjc_admin.id),
        "email": cjc_admin.email,
        "role": cjc_admin.role.value,
        "institution_id": str(cjc_admin.institution_id),
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get(
            "/api/admin/scanner-devices",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        devices = resp.json()
        device_names = [d["name"] for d in devices]
        assert "CJC Gym Entrance Kiosk" in device_names
