import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.models.attendee import Attendee, AttendeeType
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.utils.security import hash_password


@pytest.mark.asyncio
async def test_attendees_list_strict_tenant_isolation(test_session):
    """Test that CJC admin and AdDU admin ONLY see attendees belonging to their own institution."""
    # 1. Create CJC & AdDU institutions
    cjc = Institution(name="CJC Test", code=f"cjc_{uuid.uuid4().hex[:6]}", is_active=True)
    addu = Institution(name="AdDU Test", code=f"addu_{uuid.uuid4().hex[:6]}", is_active=True)
    test_session.add_all([cjc, addu])
    await test_session.flush()

    # 2. Create Departments for each
    cjc_dept = Organization(
        institution_id=cjc.id,
        name="CJC CCIS",
        code="CCIS",
        org_type=OrgType.COLLEGE,
    )
    addu_dept = Organization(
        institution_id=addu.id,
        name="AdDU CS",
        code="CS_DEPT",
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
    await test_session.flush()

    # 4. Create Attendees for each
    cjc_student = Attendee(
        institution_id=cjc.id,
        organization_id=cjc_dept.id,
        identifier="CJC-STUD-001",
        first_name="John",
        last_name="Doe",
        email=f"john_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        attendee_type=AttendeeType.student,
        consent_given=True,
    )
    addu_student = Attendee(
        institution_id=addu.id,
        organization_id=addu_dept.id,
        identifier="ADDU-STUD-001",
        first_name="Maria",
        last_name="Santos",
        email=f"maria_{uuid.uuid4().hex[:6]}@addu.edu.ph",
        attendee_type=AttendeeType.student,
        consent_given=True,
    )
    test_session.add_all([cjc_student, addu_student])
    await test_session.commit()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # CJC Admin Login
        cjc_login = await ac.post("/api/auth/login", json={"email": cjc_admin.email, "password": "Password123!"})
        assert cjc_login.status_code == 200
        cjc_token = cjc_login.json()["access_token"]

        # AdDU Admin Login
        addu_login = await ac.post("/api/auth/login", json={"email": addu_admin.email, "password": "Password123!"})
        assert addu_login.status_code == 200
        addu_token = addu_login.json()["access_token"]

        # CJC Admin lists attendees
        cjc_resp = await ac.get("/api/attendees", headers={"Authorization": f"Bearer {cjc_token}"})
        assert cjc_resp.status_code == 200
        cjc_attendees = cjc_resp.json()
        assert len(cjc_attendees) == 1
        assert cjc_attendees[0]["identifier"] == "CJC-STUD-001"
        assert cjc_attendees[0]["first_name"] == "John"

        # AdDU Admin lists attendees
        addu_resp = await ac.get("/api/attendees", headers={"Authorization": f"Bearer {addu_token}"})
        assert addu_resp.status_code == 200
        addu_attendees = addu_resp.json()
        assert len(addu_attendees) == 1
        assert addu_attendees[0]["identifier"] == "ADDU-STUD-001"
        assert addu_attendees[0]["first_name"] == "Maria"

        # Cross-Tenant access check: CJC Admin cannot get AdDU student
        cross_get = await ac.get(f"/api/attendees/{addu_student.id}", headers={"Authorization": f"Bearer {cjc_token}"})
        assert cross_get.status_code == 404
