import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.utils.security import hash_password


@pytest.mark.asyncio
async def test_super_admin_institution_edit_and_reset_admin(test_session):
    """Test Super Admin can update institution details and reset campus admin password."""
    # 1. Create Super Admin
    sa = User(
        email=f"sa_{uuid.uuid4().hex[:6]}@attendify.edu",
        password_hash=hash_password("Password123!"),
        first_name="Super",
        last_name="Admin",
        role=UserRole.super_admin,
    )
    # 2. Create Institution & Campus Admin
    inst = Institution(
        name="Original University",
        code=f"orig_{uuid.uuid4().hex[:6]}",
        logo_url="https://orig.edu/logo.png",
        is_active=True,
    )
    test_session.add_all([sa, inst])
    await test_session.flush()

    campus_admin = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@orig.edu",
        password_hash=hash_password("OldPassword123!"),
        first_name="Campus",
        last_name="Admin",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(campus_admin)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Login Super Admin
        login_resp = await ac.post(
            "/api/auth/login",
            json={"email": sa.email, "password": "Password123!"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Edit Institution Details (Name & Logo)
        edit_resp = await ac.put(
            f"/api/super-admin/institutions/{inst.id}",
            headers=headers,
            json={
                "name": "Updated University Name",
                "code": inst.code,
                "logo_url": "https://updated.edu/logo.png",
                "is_active": True,
            },
        )
        assert edit_resp.status_code == 200
        edit_data = edit_resp.json()
        assert edit_data["name"] == "Updated University Name"
        assert edit_data["logo_url"] == "https://updated.edu/logo.png"

        # 4. Reset Campus Admin Password
        reset_resp = await ac.post(
            f"/api/super-admin/institutions/{inst.id}/reset-admin",
            headers=headers,
            json={"new_password": "NewSecurePassword123!"},
        )
        assert reset_resp.status_code == 200
        assert reset_resp.json()["success"] is True

        # 5. Verify Campus Admin can log in with new password
        admin_login = await ac.post(
            "/api/auth/login",
            json={"email": campus_admin.email, "password": "NewSecurePassword123!"},
        )
        assert admin_login.status_code == 200

        # 6. Fetch Multi-Campus Analytics
        analytics_resp = await ac.get(
            "/api/super-admin/analytics/multi-campus",
            headers=headers,
        )
        assert analytics_resp.status_code == 200
        analytics_data = analytics_resp.json()
        assert "daily_attendance" in analytics_data
        assert "biometric_telemetry" in analytics_data
        assert "scanner_fleet" in analytics_data
        assert "campus_shares" in analytics_data
