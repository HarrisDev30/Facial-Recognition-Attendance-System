import uuid
from datetime import UTC, datetime

from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.event import Event, EventStatus, EventTargetScope, EventType
from sqlalchemy import String, case, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


def _event_from_dict(data: dict, created_by: uuid.UUID) -> Event:
    data = dict(data)
    if "event_type" in data and isinstance(data["event_type"], str):
        data["event_type"] = EventType(data["event_type"])
    if "status" in data and isinstance(data["status"], str):
        data["status"] = EventStatus(data["status"])
    if "department_id" in data:
        dept_val = data.pop("department_id")
        if dept_val and "organization_id" not in data:
            data["organization_id"] = dept_val
    if "organization_id" in data and isinstance(data["organization_id"], str):
        data["organization_id"] = uuid.UUID(data["organization_id"])
    return Event(**data, created_by=created_by)


def _session_from_dict(data: dict, event_id: uuid.UUID) -> AttendanceSession:
    data = dict(data)
    if "status" in data and isinstance(data["status"], str):
        data["status"] = SessionStatus(data["status"])
    return AttendanceSession(event_id=event_id, **data)


async def create_event(
    session: AsyncSession, data: dict, created_by: uuid.UUID
) -> Event:
    event = _event_from_dict(data, created_by)
    session.add(event)
    await session.flush()
    res = await session.execute(
        select(Event).options(selectinload(Event.organization)).where(Event.id == event.id)
    )
    event_obj = res.scalar_one()

    # Trigger notifications for co-hosts and students
    try:
        from app.models.notification import NotificationType
        from app.services import notification_service

        host_name = event_obj.organization.code if event_obj.organization else "Host Dept"

        # Co-host invitations for department admins
        if event_obj.co_host_dept_ids and isinstance(event_obj.co_host_dept_ids, list):
            for cohost_id_str in event_obj.co_host_dept_ids:
                try:
                    cohost_uuid = uuid.UUID(cohost_id_str)
                    await notification_service.notify_department_admins(
                        session=session,
                        organization_id=cohost_uuid,
                        title=f"Co-Host Tagged: {event_obj.name}",
                        message=f"Your department was added as a co-host for event '{event_obj.name}' by {host_name}.",
                        notification_type=NotificationType.cohost_invite,
                        link_url="/admin/events",
                    )
                except ValueError:
                    pass

        # Target student announcements
        target_org_uuids = []
        if event_obj.target_scope == EventTargetScope.department_only and event_obj.organization_id:
            target_org_uuids = [event_obj.organization_id]
        elif event_obj.target_scope == EventTargetScope.selected_departments and event_obj.co_host_dept_ids:
            target_org_uuids = [event_obj.organization_id] if event_obj.organization_id else []
            for cid in event_obj.co_host_dept_ids:
                try:
                    target_org_uuids.append(uuid.UUID(cid))
                except ValueError:
                    pass

        await notification_service.notify_target_students(
            session=session,
            organization_ids=target_org_uuids if event_obj.target_scope != EventTargetScope.all else [],
            title=f"New Event: {event_obj.name}",
            message=f"A new event '{event_obj.name}' has been announced for your department by {host_name}.",
            notification_type=NotificationType.event_announcement,
            link_url="/student/events",
        )
    except Exception as e:
        print(f"Error sending event notifications: {e}")

    await session.commit()
    return event_obj


async def get_events(
    session: AsyncSession, skip: int = 0, limit: int = 100,
    organization_id: str | None = None,
    department_id: str | None = None,
) -> list[Event]:
    org_filter = organization_id or department_id
    query = (
        select(Event)
        .options(selectinload(Event.organization))
        .order_by(Event.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if org_filter:
        try:
            org_uuid = uuid.UUID(org_filter)
            org_str = str(org_uuid)
            query = query.where(
                or_(
                    Event.organization_id == org_uuid,
                    Event.target_scope == EventTargetScope.all,
                    cast(Event.co_host_dept_ids, String).like(f"%{org_str}%"),
                )
            )
        except ValueError:
            pass
    result = await session.execute(query)
    return list(result.scalars().all())


async def count_events(
    session: AsyncSession,
    organization_id: str | None = None,
    department_id: str | None = None,
) -> int:
    org_filter = organization_id or department_id
    query = select(func.count(Event.id))
    if org_filter:
        try:
            org_uuid = uuid.UUID(org_filter)
            org_str = str(org_uuid)
            query = query.where(
                or_(
                    Event.organization_id == org_uuid,
                    Event.target_scope == EventTargetScope.all,
                    cast(Event.co_host_dept_ids, String).like(f"%{org_str}%"),
                )
            )
        except ValueError:
            pass
    result = await session.execute(query)
    return result.scalar() or 0


async def get_event(session: AsyncSession, event_id: uuid.UUID) -> Event | None:
    res = await session.execute(
        select(Event).options(selectinload(Event.organization)).where(Event.id == event_id)
    )
    return res.scalar_one_or_none()


async def update_event(
    session: AsyncSession, event_id: uuid.UUID, data: dict
) -> Event | None:
    event = await session.get(Event, event_id)
    if event is None:
        return None
    if "event_type" in data and isinstance(data["event_type"], str):
        data["event_type"] = EventType(data["event_type"])
    if "status" in data and isinstance(data["status"], str):
        data["status"] = EventStatus(data["status"])
    if "department_id" in data:
        dept_val = data.pop("department_id")
        if dept_val and "organization_id" not in data:
            data["organization_id"] = dept_val
    if "organization_id" in data and isinstance(data["organization_id"], str):
        data["organization_id"] = uuid.UUID(data["organization_id"])

    for key, value in data.items():
        setattr(event, key, value)
    event.updated_at = datetime.now(UTC)
    await session.flush()
    return event


async def delete_event(session: AsyncSession, event_id: uuid.UUID) -> bool:
    event = await session.get(Event, event_id)
    if event is None:
        return False
    await session.delete(event)
    await session.flush()
    return True


async def create_session(
    session: AsyncSession, event_id: uuid.UUID, data: dict
) -> AttendanceSession:
    att_session = _session_from_dict(data, event_id)
    session.add(att_session)
    await session.flush()
    return att_session


async def get_sessions(
    session: AsyncSession, event_id: uuid.UUID
) -> list[AttendanceSession]:
    result = await session.execute(
        select(AttendanceSession)
        .where(AttendanceSession.event_id == event_id)
        .order_by(AttendanceSession.start_time)
    )
    return list(result.scalars().all())


async def get_session(
    session: AsyncSession, session_id: uuid.UUID
) -> AttendanceSession | None:
    return await session.get(AttendanceSession, session_id)


async def update_session(
    session: AsyncSession, session_id: uuid.UUID, data: dict
) -> AttendanceSession | None:
    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None:
        return None
    if "status" in data and isinstance(data["status"], str):
        data["status"] = SessionStatus(data["status"])
    for key, value in data.items():
        setattr(att_session, key, value)
    await session.flush()
    return att_session


async def activate_session(
    session: AsyncSession, session_id: uuid.UUID
) -> AttendanceSession | None:
    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None:
        return None
    att_session.status = SessionStatus.active
    att_session.activated_at = datetime.now(UTC)
    await session.flush()
    return att_session


async def get_upcoming_events(
    session: AsyncSession, skip: int = 0, limit: int = 100, organization_id: str | None = None
) -> list[tuple[Event, int, int]]:
    today = datetime.now(UTC).date()
    active_session_subquery = (
        select(AttendanceSession.event_id)
        .where(AttendanceSession.status == SessionStatus.active)
    )
    query = (
        select(
            Event,
            func.count(AttendanceSession.id).label("sessions_count"),
            func.sum(
                case((AttendanceSession.status == SessionStatus.active, 1), else_=0)
            ).label("active_sessions_count"),
        )
        .outerjoin(AttendanceSession, AttendanceSession.event_id == Event.id)
        .where(
            or_(
                Event.start_date >= today,
                Event.id.in_(active_session_subquery),
            ),
            Event.status != EventStatus.cancelled,
        )
    )
    if organization_id:
        try:
            org_uuid = uuid.UUID(organization_id)
            org_str = str(org_uuid)
            query = query.where(
                or_(
                    Event.organization_id == org_uuid,
                    Event.target_scope == EventTargetScope.all,
                    cast(Event.co_host_dept_ids, String).like(f"%{org_str}%"),
                )
            )
        except ValueError:
            pass

    query = query.group_by(Event.id).order_by(Event.start_date.asc()).offset(skip).limit(limit)
    result = await session.execute(query)
    return [(row[0], row[1] or 0, row[2] or 0) for row in result.all()]


async def get_all_events(
    session: AsyncSession, skip: int = 0, limit: int = 100, organization_id: str | None = None
) -> list[tuple[Event, int, int]]:
    query = (
        select(
            Event,
            func.count(AttendanceSession.id).label("sessions_count"),
            func.sum(
                case((AttendanceSession.status == SessionStatus.active, 1), else_=0)
            ).label("active_sessions_count"),
        )
        .outerjoin(AttendanceSession, AttendanceSession.event_id == Event.id)
        .where(Event.status != EventStatus.cancelled)
    )
    if organization_id:
        try:
            org_uuid = uuid.UUID(organization_id)
            org_str = str(org_uuid)
            query = query.where(
                or_(
                    Event.organization_id == org_uuid,
                    Event.target_scope == EventTargetScope.all,
                    cast(Event.co_host_dept_ids, String).like(f"%{org_str}%"),
                )
            )
        except ValueError:
            pass

    query = query.group_by(Event.id).order_by(Event.start_date.desc()).offset(skip).limit(limit)
    result = await session.execute(query)
    return [(row[0], row[1] or 0, row[2] or 0) for row in result.all()]


async def count_upcoming_events(session: AsyncSession, organization_id: str | None = None) -> int:
    today = datetime.now(UTC).date()
    active_session_subquery = (
        select(AttendanceSession.event_id)
        .where(AttendanceSession.status == SessionStatus.active)
    )
    query = select(func.count(Event.id)).where(
        or_(
            Event.start_date >= today,
            Event.id.in_(active_session_subquery),
        ),
        Event.status != EventStatus.cancelled,
    )
    if organization_id:
        try:
            org_uuid = uuid.UUID(organization_id)
            org_str = str(org_uuid)
            query = query.where(
                or_(
                    Event.organization_id == org_uuid,
                    Event.target_scope == EventTargetScope.all,
                    cast(Event.co_host_dept_ids, String).like(f"%{org_str}%"),
                )
            )
        except ValueError:
            pass

    result = await session.execute(query)
    return result.scalar() or 0


async def count_all_events(session: AsyncSession) -> int:
    result = await session.execute(
        select(func.count(Event.id)).where(
            Event.status != EventStatus.cancelled,
        )
    )
    return result.scalar() or 0


async def deactivate_session(
    session: AsyncSession, session_id: uuid.UUID
) -> AttendanceSession | None:
    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None:
        return None
    att_session.status = SessionStatus.completed
    att_session.deactivated_at = datetime.now(UTC)
    await session.flush()
    return att_session
