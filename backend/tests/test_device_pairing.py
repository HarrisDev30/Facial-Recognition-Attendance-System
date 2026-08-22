import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.institution import Institution
from app.models.user import User, UserRole
from app.models.scanner_device import ScannerPairingCode, ScannerDevice
from app.services.auth_service import create_access_token
from sqlalchemy import select


@pytest.mark.asyncio
async def test_admin_generate_pairing_code_and_kiosk_pairing(test_session):
    """Test full 6-digit OTP hardware pairing flow for entrance kiosks."""
    # 1. Create Institution and Admin user
    inst = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    test_session.add(inst)
    await test_session.flush()

    admin = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash="mock_hash",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(admin)
    await test_session.commit()

    token = create_access_token({
        "sub": str(admin.id),
        "email": admin.email,
        "role": admin.role.value,
        "institution_id": str(admin.institution_id),
        "institution_code": inst.code,
    })
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 2. Admin calls generate-pairing-code
        resp = await ac.post(
            "/api/admin/scanner-devices/generate-pairing-code",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        code = data["code"]
        assert len(code) == 6
        assert code.isdigit()
        assert data["expires_in_seconds"] == 900

        # 3. Entrance Kiosk (Headless / Public) calls pair endpoint
        pair_payload = {
            "code": code,
            "name": "North Gate Turnstile 1",
            "device_type": "workstation_laptop",
            "location": "North Entrance",
        }
        pair_resp = await ac.post("/api/devices/pair", json=pair_payload)
        assert pair_resp.status_code == 201
        pair_data = pair_resp.json()
        assert pair_data["name"] == "North Gate Turnstile 1"
        assert pair_data["institution_id"] == str(inst.id)
        assert pair_data["institution_code"] == inst.code
        device_token = pair_data["device_token"]
        assert device_token is not None

        # 4. Verify code is now used and cannot be reused
        reuse_resp = await ac.post("/api/devices/pair", json=pair_payload)
        assert reuse_resp.status_code == 400
        assert "Invalid or expired" in reuse_resp.json()["detail"]

        # 5. Verify token verification endpoint
        verify_resp = await ac.get(f"/api/devices/verify-token/{device_token}")
        assert verify_resp.status_code == 200
        assert verify_resp.json()["valid"] is True
        assert verify_resp.json()["institution_id"] == str(inst.id)


@pytest.mark.asyncio
async def test_expired_pairing_code_rejection(test_session):
    """Test that expired pairing codes are rejected."""
    inst = Institution(name="Ateneo de Davao University", code=f"addu_{uuid.uuid4().hex[:6]}")
    test_session.add(inst)
    await test_session.flush()

    user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@addu.edu.ph",
        password_hash="mock_hash",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(user)
    await test_session.flush()

    # Expired code (30 mins ago)
    expired_code = ScannerPairingCode(
        institution_id=inst.id,
        created_by=user.id,
        code="999888",
        expires_at=datetime.now(UTC) - timedelta(minutes=30),
        is_used=False,
    )
    test_session.add(expired_code)
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        pair_payload = {
            "code": "999888",
            "name": "Expired Device Test",
            "device_type": "mobile_scanner",
        }
        resp = await ac.post("/api/devices/pair", json=pair_payload)
        assert resp.status_code == 400
        assert "Invalid or expired" in resp.json()["detail"]
