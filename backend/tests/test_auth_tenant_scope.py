import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.utils.security import hash_password


@pytest.mark.asyncio
async def test_cross_tenant_login_rejection(test_session):
    """Verify that logging into Institution A's account from Institution B's portal is rejected with 401."""
    # 1. Create two distinct institutions
    inst_cjc = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    inst_addu = Institution(name="Ateneo de Davao", code=f"addu_{uuid.uuid4().hex[:6]}")
    test_session.add(inst_cjc)
    test_session.add(inst_addu)
    await test_session.flush()

    # 2. Create CJC admin user
    cjc_admin_email = f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph"
    cjc_admin = User(
        email=cjc_admin_email,
        password_hash=hash_password("admin123!"),
        role=UserRole.admin,
        institution_id=inst_cjc.id,
    )
    test_session.add(cjc_admin)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 3. Login with CJC admin on CJC portal -> MUST succeed (200 OK)
        success_resp = await ac.post(
            "/api/auth/login",
            json={
                "email": cjc_admin_email,
                "password": "admin123!",
                "institution_slug": inst_cjc.code,
            },
        )
        assert success_resp.status_code == 200
        data = success_resp.json()
        assert "access_token" in data

        # 4. Attempt login with CJC admin on ADDU portal -> MUST be rejected with 401 Unauthorized
        rejected_resp = await ac.post(
            "/api/auth/login",
            json={
                "email": cjc_admin_email,
                "password": "admin123!",
                "institution_slug": inst_addu.code,
            },
        )
        assert rejected_resp.status_code == 401
        err_data = rejected_resp.json()
        # Ensure error message is generic and does NOT leak tenant information
        assert err_data["detail"] == "Invalid email, password, or institution portal."
