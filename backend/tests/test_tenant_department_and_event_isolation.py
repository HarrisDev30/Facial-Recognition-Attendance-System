import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.utils.security import hash_password


@pytest.mark.asyncio
async def test_tenant_department_and_event_isolation(test_session):
    """Test that departments and events are strictly isolated per campus."""
    # 1. Create CJC & AdDU institutions
    cjc = Institution(name="CJC Scope Test", code=f"cjc_{uuid.uuid4().hex[:6]}", is_active=True)
    addu = Institution(name="AdDU Scope Test", code=f"addu_{uuid.uuid4().hex[:6]}", is_active=True)
    test_session.add_all([cjc, addu])
    await test_session.flush()

    # 2. Create Departments for each
    cjc_dept = Organization(
        institution_id=cjc.id,
        name="CJC College of Computing",
        code="CJC_CCIS",
        org_type=OrgType.COLLEGE,
    )
    addu_dept = Organization(
        institution_id=addu.id,
        name="AdDU Computer Science",
        code="ADDU_CS",
        org_type=OrgType.COLLEGE,
    )
    test_session.add_all([cjc_dept, addu_dept])
    await test_session.flush()

    # 3. Create Admins for each
    cjc_admin = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash=hash_password("Password123!"),
        first_name="CJC",
        last_name="Admin",
        role=UserRole.admin,
        institution_id=cjc.id,
    )
    addu_admin = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@addu.edu.ph",
        password_hash=hash_password("Password123!"),
        first_name="AdDU",
        last_name="Admin",
        role=UserRole.admin,
        institution_id=addu.id,
    )
    test_session.add_all([cjc_admin, addu_admin])
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # CJC Admin Login
        cjc_login = await ac.post("/api/auth/login", json={"email": cjc_admin.email, "password": "Password123!"})
        cjc_token = cjc_login.json()["access_token"]
        cjc_headers = {"Authorization": f"Bearer {cjc_token}"}

        # AdDU Admin Login
        addu_login = await ac.post("/api/auth/login", json={"email": addu_admin.email, "password": "Password123!"})
        addu_token = addu_login.json()["access_token"]
        addu_headers = {"Authorization": f"Bearer {addu_token}"}

        # Check 1: CJC Admin sees ONLY CJC departments on GET /api/departments
        cjc_depts_resp = await ac.get("/api/departments", headers=cjc_headers)
        assert cjc_depts_resp.status_code == 200
        cjc_depts = cjc_depts_resp.json()["items"]
        assert len(cjc_depts) == 1
        assert cjc_depts[0]["code"] == "CJC_CCIS"

        # Check 2: AdDU Admin sees ONLY AdDU departments on GET /api/departments
        addu_depts_resp = await ac.get("/api/departments", headers=addu_headers)
        assert addu_depts_resp.status_code == 200
        addu_depts = addu_depts_resp.json()["items"]
        assert len(addu_depts) == 1
        assert addu_depts[0]["code"] == "ADDU_CS"

        # Check 3: CJC Admin cannot create event targeting AdDU department
        cross_event_resp = await ac.post(
            "/api/events",
            json={
                "name": "Cross Campus Event",
                "event_type": "seminar",
                "start_date": "2026-09-01",
                "end_date": "2026-09-01",
                "organization_id": str(addu_dept.id),
            },
            headers=cjc_headers,
        )
        assert cross_event_resp.status_code == 404

        # Check 4: CJC Admin creates CJC event and lists events
        cjc_event_resp = await ac.post(
            "/api/events",
            json={
                "name": "CJC Hackathon 2026",
                "event_type": "campus_activity",
                "start_date": "2026-09-01",
                "end_date": "2026-09-01",
                "organization_id": str(cjc_dept.id),
            },
            headers=cjc_headers,
        )
        assert cjc_event_resp.status_code == 201

        # Check 5: AdDU Admin cannot see CJC event
        addu_events_resp = await ac.get("/api/events", headers=addu_headers)
        assert addu_events_resp.status_code == 200
        assert len(addu_events_resp.json()["items"]) == 0

        # Check 6: CJC Admin sees the created CJC event
        cjc_events_resp = await ac.get("/api/events", headers=cjc_headers)
        assert cjc_events_resp.status_code == 200
        assert len(cjc_events_resp.json()["items"]) == 1
        assert cjc_events_resp.json()["items"][0]["name"] == "CJC Hackathon 2026"
