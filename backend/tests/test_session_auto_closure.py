import uuid
from datetime import UTC, datetime, timedelta
import pytest
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.models.event import Event, EventStatus, EventType
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.services.event_service import auto_close_expired_sessions, extend_session, create_event
from app.services.scanner_service import process_frame


@pytest.mark.asyncio
async def test_session_time_gated_rejection_and_auto_closure(test_session):
    """Verify that frames are rejected when end_time has passed and session is marked completed."""
    # 1. Create Institution, Organization, User, Event
    inst = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    test_session.add(inst)
    await test_session.flush()

    user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash="mock_hashed_pw",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(user)
    await test_session.flush()

    org = Organization(institution_id=inst.id, name="CCIS", code="CCIS", org_type=OrgType.COLLEGE)
    test_session.add(org)
    await test_session.flush()

    event = Event(
        institution_id=inst.id,
        organization_id=org.id,
        name="Annual IT Conference",
        event_type=EventType.conference,
        start_date=datetime.now(UTC).date(),
        end_date=datetime.now(UTC).date(),
        status=EventStatus.active,
        created_by=user.id,
    )
    test_session.add(event)
    await test_session.flush()

    # 2. Create an attendance session that expired 10 minutes ago
    past_start = datetime.now(UTC) - timedelta(minutes=60)
    past_end = datetime.now(UTC) - timedelta(minutes=10)
    expired_sess = AttendanceSession(
        event_id=event.id,
        name="Morning Keynote",
        start_time=past_start,
        end_time=past_end,
        status=SessionStatus.active,
    )
    test_session.add(expired_sess)
    await test_session.commit()

    # 3. Simulate frame arrival for expired session
    dummy_image_bytes = b"fake_jpeg_payload_bytes"
    result = await process_frame(test_session, expired_sess.id, dummy_image_bytes)

    # Frame MUST be rejected with session_expired = True
    assert result.get("session_expired") is True
    assert result.get("identified") is False

    # Database session MUST now be transitioned to completed
    await test_session.refresh(expired_sess)
    assert expired_sess.status == SessionStatus.completed
    assert expired_sess.deactivated_at is not None


@pytest.mark.asyncio
async def test_session_extension_action(test_session):
    """Verify that extend_session increases end_time by +15 minutes and restores active status."""
    inst = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    test_session.add(inst)
    await test_session.flush()

    user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash="mock_hashed_pw",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(user)
    await test_session.flush()

    org = Organization(institution_id=inst.id, name="CCIS", code="CCIS", org_type=OrgType.COLLEGE)
    test_session.add(org)
    await test_session.flush()

    event = Event(
        institution_id=inst.id,
        organization_id=org.id,
        name="Workshop",
        event_type=EventType.workshop,
        start_date=datetime.now(UTC).date(),
        end_date=datetime.now(UTC).date(),
        status=EventStatus.active,
        created_by=user.id,
    )
    test_session.add(event)
    await test_session.flush()

    now = datetime.now(UTC)
    sess = AttendanceSession(
        event_id=event.id,
        name="Hands-on Lab",
        start_time=now - timedelta(minutes=45),
        end_time=now - timedelta(minutes=5),
        status=SessionStatus.completed,
    )
    test_session.add(sess)
    await test_session.commit()

    # Extend session by 15 minutes
    extended = await extend_session(test_session, sess.id, minutes=15)
    assert extended is not None
    assert extended.status == SessionStatus.active
    assert extended.end_time > now


@pytest.mark.asyncio
async def test_auto_create_session_in_event(test_session):
    """Verify 1-click single-session setup creates default active session."""
    inst = Institution(name="Cor Jesu College", code=f"cjc_{uuid.uuid4().hex[:6]}")
    test_session.add(inst)
    await test_session.flush()

    user = User(
        email=f"admin_{uuid.uuid4().hex[:6]}@cjc.edu.ph",
        password_hash="mock_hashed_pw",
        role=UserRole.admin,
        institution_id=inst.id,
    )
    test_session.add(user)
    await test_session.flush()

    org = Organization(institution_id=inst.id, name="CCIS", code="CCIS", org_type=OrgType.COLLEGE)
    test_session.add(org)
    await test_session.flush()

    event_data = {
        "institution_id": str(inst.id),
        "organization_id": str(org.id),
        "name": "General Assembly",
        "event_type": "assembly",
        "start_date": datetime.now(UTC).date(),
        "end_date": datetime.now(UTC).date(),
        "status": "active",
        "auto_create_session": True,
        "default_session_name": "Main Entrance Check-In",
    }

    event = await create_event(test_session, event_data, user.id)
    await test_session.commit()

    # Check that session was automatically created
    from app.services.event_service import get_sessions
    sessions = await get_sessions(test_session, event.id)
    assert len(sessions) == 1
    assert sessions[0].name == "Main Entrance Check-In"
    assert sessions[0].status == SessionStatus.active
