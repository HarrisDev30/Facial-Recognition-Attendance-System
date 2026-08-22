import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_hardware_pairing_code_and_fleet_scoping(test_session):
    """Test generating 6-digit pairing code, device pairing, and fleet listing scoping."""
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
        # 1. Generate 6-digit pairing code
        gen_resp = await ac.post(
            "/api/admin/scanner-devices/generate-pairing-code",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert gen_resp.status_code == 200
        code_data = gen_resp.json()
        assert len(code_data["code"]) == 6
        assert code_data["code"].isdigit()

        # 2. Pair entrance hardware kiosk with the 6-digit code
        pair_resp = await ac.post(
            "/api/devices/pair",
            json={
                "code": code_data["code"],
                "name": "North Gate Turnstile 1",
                "device_type": "dedicated_scanner",
                "location": "North Campus Entrance",
            },
        )
        assert pair_resp.status_code == 201
        paired_data = pair_resp.json()
        assert paired_data["name"] == "North Gate Turnstile 1"
        assert paired_data["institution_id"] == str(inst_cjc.id)
        assert "device_token" in paired_data

        # 3. List scanner devices for CJC admin
        list_resp = await ac.get(
            "/api/admin/scanner-devices",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert list_resp.status_code == 200
        devices = list_resp.json()
        device_names = [d["name"] for d in devices]
        assert "North Gate Turnstile 1" in device_names
