import uuid
from datetime import UTC, datetime, timedelta
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.models.attendee import Attendee, AttendeeType
from app.models.event import Event, EventStatus, EventType
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.services.auth_service import create_access_token


@pytest.mark.asyncio
async def test_session_csv_pdf_and_analytics(test_session):
    """Test generating official CSV export, accredited PDF roster, and live analytics."""
    # 1. Setup tenant, org, admin, event, session, attendee, log
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
    await test_session.flush()

    org = Organization(institution_id=inst.id, name="CCIS", code="CCIS", org_type=OrgType.COLLEGE)
    test_session.add(org)
    await test_session.flush()

    event = Event(
        institution_id=inst.id,
        organization_id=org.id,
        name="Annual IT Summit",
        event_type=EventType.conference,
        start_date=datetime.now(UTC).date(),
        end_date=datetime.now(UTC).date(),
        status=EventStatus.active,
        created_by=admin.id,
    )
    test_session.add(event)
    await test_session.flush()

    now = datetime.now(UTC)
    att_session = AttendanceSession(
        event_id=event.id,
        name="Keynote Session",
        venue="Gymnasium",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=1),
        status=SessionStatus.active,
    )
    test_session.add(att_session)
    await test_session.flush()

    student = Attendee(
        institution_id=inst.id,
        organization_id=org.id,
        identifier="2023-0001",
        first_name="Juan",
        last_name="Dela Cruz",
        attendee_type=AttendeeType.student,
    )
    test_session.add(student)
    await test_session.flush()

    log = AttendanceLog(
        session_id=att_session.id,
        attendee_id=student.id,
        verification_method=VerificationMethod.face_recognition,
        confidence_score=0.96,
        verified_at=now,
    )
    test_session.add(log)
    await test_session.commit()

    token = create_access_token({
        "sub": str(admin.id),
        "email": admin.email,
        "role": admin.role.value,
        "institution_id": str(admin.institution_id),
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test CSV Download
        csv_resp = await ac.get(f"/api/reports/sessions/{att_session.id}/csv", headers=headers)
        assert csv_resp.status_code == 200
        assert "text/csv" in csv_resp.headers["content-type"]
        csv_content = csv_resp.text
        assert "Attendify Biometric Attendance Report" in csv_content
        assert "Cor Jesu College" in csv_content
        assert "2023-0001" in csv_content
        assert "Dela Cruz" in csv_content

        # 2. Test PDF Download
        pdf_resp = await ac.get(f"/api/reports/sessions/{att_session.id}/pdf", headers=headers)
        assert pdf_resp.status_code == 200
        assert "application/pdf" in pdf_resp.headers["content-type"]
        pdf_bytes = pdf_resp.content
        assert pdf_bytes.startswith(b"%PDF")
        assert len(pdf_bytes) > 500

        # 3. Test Analytics
        analytics_resp = await ac.get(f"/api/reports/sessions/{att_session.id}/analytics", headers=headers)
        assert analytics_resp.status_code == 200
        analytics_data = analytics_resp.json()
        assert analytics_data["total_checkins"] == 1
        assert "face_recognition" in analytics_data["method_breakdown"]
        assert len(analytics_data["velocity_timeline"]) >= 1
