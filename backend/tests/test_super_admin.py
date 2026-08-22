import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_super_admin_telemetry_and_rbac(test_session):
    """Test RBAC security guard on /api/super-admin/telemetry and data payload structure."""
    # 1. Regular University Admin
    inst = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    test_session.add(inst)
    await test_session.flush()

    univ_admin = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash="mock_hash",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(univ_admin)

    # 2. Super Admin
    super_admin = User(
        email=f"superadmin_{uuid.uuid4().hex[:6]}@attendify.edu",
        password_hash="mock_hash",
        role=UserRole.super_admin,
    )
    test_session.add(super_admin)
    await test_session.commit()

    univ_admin_token = create_access_token({
        "sub": str(univ_admin.id),
        "email": univ_admin.email,
        "role": univ_admin.role.value,
        "institution_id": str(univ_admin.institution_id),
    })

    super_admin_token = create_access_token({
        "sub": str(super_admin.id),
        "email": super_admin.email,
        "role": super_admin.role.value,
        "institution_id": None,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Regular admin MUST receive 403 Forbidden
        denied_resp = await ac.get(
            "/api/super-admin/telemetry",
            headers={"Authorization": f"Bearer {univ_admin_token}"},
        )
        assert denied_resp.status_code == 403

        # Super admin MUST receive 200 OK with telemetry structure
        allowed_resp = await ac.get(
            "/api/super-admin/telemetry",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert allowed_resp.status_code == 200
        data = allowed_resp.json()
        assert "platform" in data
        assert "counts" in data
        assert "vector_engine" in data
        assert data["counts"]["total_institutions"] >= 1


@pytest.mark.asyncio
async def test_super_admin_onboard_institution_and_toggle(test_session):
    """Test super-admin 1-click university onboarding and active status toggling."""
    super_admin = User(
        email=f"superadmin_{uuid.uuid4().hex[:6]}@attendify.edu",
        password_hash="mock_hash",
        role=UserRole.super_admin,
    )
    test_session.add(super_admin)
    await test_session.commit()

    super_admin_token = create_access_token({
        "sub": str(super_admin.id),
        "email": super_admin.email,
        "role": super_admin.role.value,
        "institution_id": None,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        slug = f"univ_{uuid.uuid4().hex[:6]}"
        onboard_payload = {
            "name": "State University of Mindanao",
            "code": slug,
            "logo_url": "https://example.com/logo.png",
            "admin_email": f"dean_{slug}@sum.edu.ph",
            "admin_password": "secure_password_123",
            "admin_first_name": "Dean",
            "admin_last_name": "Reyes",
        }

        # 1. Onboard new university
        onboard_res = await ac.post(
            "/api/super-admin/institutions",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json=onboard_payload,
        )
        assert onboard_res.status_code == 201
        onboard_data = onboard_res.json()
        inst_id = onboard_data["institution_id"]
        assert onboard_data["name"] == "State University of Mindanao"
        assert onboard_data["code"] == slug

        # 2. List institutions
        list_res = await ac.get(
            "/api/super-admin/institutions",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert list_res.status_code == 200
        inst_items = list_res.json()
        match = next((i for i in inst_items if i["id"] == inst_id), None)
        assert match is not None
        assert match["admin_email"] == f"dean_{slug}@sum.edu.ph"
        assert match["is_active"] is True

        # 3. Toggle institution active status
        toggle_res = await ac.patch(
            f"/api/super-admin/institutions/{inst_id}/toggle-active",
            headers={"Authorization": f"Bearer {super_admin_token}"},
        )
        assert toggle_res.status_code == 200
        assert toggle_res.json()["is_active"] is False


@pytest.mark.asyncio
async def test_maintenance_mode_and_public_status(test_session):
    """Test maintenance mode toggling and public broadcast."""
    super_admin = User(
        email=f"superadmin_{uuid.uuid4().hex[:6]}@attendify.edu",
        password_hash="mock_hash",
        role=UserRole.super_admin,
    )
    test_session.add(super_admin)
    await test_session.commit()

    super_admin_token = create_access_token({
        "sub": str(super_admin.id),
        "email": super_admin.email,
        "role": super_admin.role.value,
        "institution_id": None,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Update maintenance mode
        update_res = await ac.post(
            "/api/super-admin/system-status",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "maintenance_mode": True,
                "announcement": "Scheduled platform upgrade in progress.",
            },
        )
        assert update_res.status_code == 200
        assert update_res.json()["maintenance_mode"] is True

        # Public endpoint reflects announcement
        public_res = await ac.get("/api/public/system-status")
        assert public_res.status_code == 200
        assert public_res.json()["maintenance_mode"] is True
        assert public_res.json()["announcement"] == "Scheduled platform upgrade in progress."

        # Reset maintenance mode
        await ac.post(
            "/api/super-admin/system-status",
            headers={"Authorization": f"Bearer {super_admin_token}"},
            json={
                "maintenance_mode": False,
                "announcement": "",
            },
        )
