import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_system_settings_persistence_and_clear(test_session):
    """Test public system status, super admin update, and clear endpoint persistence."""
    super_admin = User(
        email=f"superadmin_{uuid.uuid4().hex[:6]}@attendify.edu",
        password_hash="mock_hash",
        role=UserRole.super_admin,
    )
    test_session.add(super_admin)
    await test_session.commit()

    token = create_access_token({
        "sub": str(super_admin.id),
        "email": super_admin.email,
        "role": super_admin.role.value,
        "institution_id": None,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Public system status fetch
        pub_resp = await ac.get("/api/public/system-status")
        assert pub_resp.status_code == 200
        pub_data = pub_resp.json()
        assert "maintenance_mode" in pub_data
        assert "announcement" in pub_data

        # 2. Update status via super admin
        update_resp = await ac.post(
            "/api/super-admin/system-status",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "maintenance_mode": True,
                "announcement": "Scheduled CJC Maintenance",
                "target_campus": "cjc",
                "banner_type": "orange",
            },
        )
        assert update_resp.status_code == 200
        data = update_resp.json()
        assert data["maintenance_mode"] is True
        assert data["announcement"] == "Scheduled CJC Maintenance"
        assert data["target_campus"] == "cjc"

        # 3. Clear status via super admin
        clear_resp = await ac.post(
            "/api/super-admin/system-status/clear",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert clear_resp.status_code == 200
        cleared_data = clear_resp.json()
        assert cleared_data["maintenance_mode"] is False
        assert cleared_data["announcement"] == ""
