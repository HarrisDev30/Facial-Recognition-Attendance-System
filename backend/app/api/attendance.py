import uuid
from datetime import date

from app.database import get_session
from app.middleware.auth import DomainScope, get_current_user, get_domain_scope, require_admin_or_marshal
from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.models.attendance_session import AttendanceSession
from app.models.attendee import Attendee
from app.models.event import Event, EventStatus, EventTargetScope
from app.models.user import User, UserRole
from app.schemas.attendance import (
    AttendanceLogResponse,
    AttendanceSummary,
    AttendeeAttendanceLogResponse,
    AttendeeAttendanceSummary,
    AttendeeEventAttendanceResponse,
    CheckInRequest,
    EventSessionAttendance,
)
from app.services import attendance_service, attendee_service
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/attendees/me/logs")
async def get_my_attendance_logs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    sort: str = Query("date_desc", pattern=r"^(date_asc|date_desc|event_name)$"),
    event_type: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        return {"items": [], "total": 0, "page": page, "size": size}

    if sort == "date_asc":
        order = AttendanceLog.verified_at.asc()
    elif sort == "event_name":
        order = Event.name.asc()
    else:
        order = AttendanceLog.verified_at.desc()

    base_where = [AttendanceLog.attendee_id == attendee.id]
    if event_type:
        base_where.append(Event.event_type == event_type)
    if start_date:
        base_where.append(AttendanceSession.start_time >= start_date)
    if end_date:
        base_where.append(AttendanceSession.start_time <= end_date)

    count_q = (
        select(func.count(AttendanceLog.id))
        .join(AttendanceSession, AttendanceLog.session_id == AttendanceSession.id)
        .join(Event, AttendanceSession.event_id == Event.id)
        .where(*base_where)
    )
    total = (await session.execute(count_q)).scalar() or 0

    query = (
        select(
            AttendanceLog,
            AttendanceSession.name.label("session_name"),
            AttendanceSession.start_time.label("session_date"),
            Event.name.label("event_name"),
            Event.event_type,
            Event.venue,
        )
        .join(AttendanceSession, AttendanceLog.session_id == AttendanceSession.id)
        .join(Event, AttendanceSession.event_id == Event.id)
        .where(*base_where)
        .order_by(order)
        .offset((page - 1) * size)
        .limit(size)
    )
    rows = (await session.execute(query)).all()

    items = [
        AttendeeAttendanceLogResponse(
            id=str(row[0].id),
            event_name=str(row.event_name),
            event_type=(
                str(row.event_type.value)
                if hasattr(row.event_type, "value")
                else str(row.event_type)
            ),
            session_name=str(row.session_name),
            session_date=row.session_date,
            check_in_time=row[0].verified_at,
            verification_method=row[0].verification_method.value,
            confidence_score=row[0].confidence_score,
            venue=str(row.venue) if row.venue else None,
        )
        for row in rows
    ]

    return {"items": items, "total": total, "page": page, "size": size}


@router.get("/attendees/me/summary", response_model=AttendeeAttendanceSummary)
async def get_my_attendance_summary(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        return AttendeeAttendanceSummary()

    logs_result = await session.execute(
        select(AttendanceLog.verified_at, AttendanceSession.event_id, Event.event_type)
        .join(AttendanceSession, AttendanceLog.session_id == AttendanceSession.id)
        .join(Event, AttendanceSession.event_id == Event.id)
        .where(AttendanceLog.attendee_id == attendee.id)
    )
    rows = logs_result.all()

    total_events_attended = len(set(r.event_id for r in rows))
    last_attendance = max((r.verified_at for r in rows), default=None)

    attendance_by_type: dict[str, set[uuid.UUID]] = {}
    for r in rows:
        etype = r.event_type.value if hasattr(r.event_type, "value") else str(r.event_type)
        if etype not in attendance_by_type:
            attendance_by_type[etype] = set()
        attendance_by_type[etype].add(r.event_id)
    attendance_by_type_counts = {k: len(v) for k, v in attendance_by_type.items()}

    inst_id = current_user.institution_id
    if not inst_id and attendee.organization_id:
        from app.models.organization import Organization
        org = await session.get(Organization, attendee.organization_id)
        if org:
            inst_id = org.institution_id

    total_events_stmt = (
        select(func.count(func.distinct(Event.id)))
        .join(AttendanceSession, AttendanceSession.event_id == Event.id)
        .where(Event.status != EventStatus.cancelled)
    )
    if inst_id:
        total_events_stmt = total_events_stmt.where(Event.institution_id == inst_id)
    if attendee.organization_id:
        org_str = str(attendee.organization_id)
        total_events_stmt = total_events_stmt.where(
            or_(
                Event.organization_id == attendee.organization_id,
                Event.target_scope == EventTargetScope.all,
                cast(Event.co_host_dept_ids, String).like(f"%{org_str}%"),
            )
        )
    total_events_result = await session.execute(total_events_stmt)
    total_events_available = total_events_result.scalar() or 0

    attendance_rate = (
        (total_events_attended / total_events_available * 100)
        if total_events_available > 0
        else 0.0
    )

    return AttendeeAttendanceSummary(
        total_events_attended=total_events_attended,
        total_events_available=total_events_available,
        attendance_rate=round(attendance_rate, 1),
        last_attendance=last_attendance,
        attendance_by_type=attendance_by_type_counts,
    )


@router.get("/attendees/me/events/{event_id}")
async def get_my_event_attendance(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    event = await session.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role != UserRole.super_admin and current_user.institution_id:
        if event.institution_id != current_user.institution_id:
            raise HTTPException(status_code=404, detail="Event not found")

    sessions_query = await session.execute(
        select(AttendanceSession)
        .where(AttendanceSession.event_id == event_id)
        .order_by(AttendanceSession.start_time)
    )
    all_sessions = list(sessions_query.scalars().all())
    session_ids = [s.id for s in all_sessions]

    logs_by_session: dict[uuid.UUID, AttendanceLog] = {}
    if session_ids:
        batch_result = await session.execute(
            select(AttendanceLog)
            .where(
                AttendanceLog.session_id.in_(session_ids),
                AttendanceLog.attendee_id == attendee.id,
            )
            .distinct(AttendanceLog.session_id)
        )
        for log in batch_result.scalars().all():
            logs_by_session[log.session_id] = log

    session_attendance = []
    for att_sess in all_sessions:
        log = logs_by_session.get(att_sess.id)
        session_attendance.append(
            EventSessionAttendance(
                session_id=str(att_sess.id),
                session_name=att_sess.name,
                venue=att_sess.venue,
                start_time=att_sess.start_time,
                end_time=att_sess.end_time,
                status=att_sess.status.value,
                verified_at=log.verified_at if log else None,
                verification_method=log.verification_method.value if log else None,
                confidence_score=log.confidence_score if log else None,
            )
        )

    return AttendeeEventAttendanceResponse(
        event_id=str(event.id),
        event_name=event.name,
        event_type=event.event_type.value,
        description=event.description,
        venue=event.venue,
        start_date=event.start_date.isoformat(),
        end_date=event.end_date.isoformat(),
        sessions=session_attendance,
    )


@router.post("/check-in", response_model=AttendanceLogResponse)
async def check_in(
    body: CheckInRequest,
    session: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher and not scope.is_marshal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Marshal or Admin privileges required to check in attendees",
        )

    sess_id = uuid.UUID(body.session_id)
    att_id = uuid.UUID(body.attendee_id)

    # Enforce session operational rights (checks department ownership and co-host assignments)
    await scope.assert_can_operate_session(sess_id, session)

    att_session = await attendance_service.get_session_for_attendance(session, sess_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    attendee = await attendee_service.get_attendee(session, att_id)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee not found")

    method = VerificationMethod(body.verification_method)
    marshal_id = scope.user.id if method == VerificationMethod.marshal_override else None

    log = await attendance_service.log_attendance(
        session=session,
        session_id=sess_id,
        attendee_id=att_id,
        verification_method=method,
        confidence_score=body.confidence_score,
        marshal_id=marshal_id,
    )
    if log is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendee already checked in to this session",
        )

    return AttendanceLogResponse(
        id=str(log.id),
        session_id=str(log.session_id),
        attendee_id=str(log.attendee_id),
        attendee_name=f"{attendee.first_name} {attendee.last_name}",
        verified_at=log.verified_at.isoformat(),
        verification_method=log.verification_method.value,
        confidence_score=log.confidence_score,
        marshal_id=str(log.marshal_id) if log.marshal_id else None,
        created_at=log.created_at.isoformat(),
    )


@router.get("/sessions/{session_id}/logs")
async def list_session_logs(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    logs = await attendance_service.get_session_logs(session, session_id)
    result = []
    for log in logs:
        result.append(
            AttendanceLogResponse(
                id=str(log.id),
                session_id=str(log.session_id),
                attendee_id=str(log.attendee_id),
                attendee_name=f"{log.attendee.first_name} {log.attendee.last_name}" if log.attendee else None,
                department_name=log.attendee.department.name if log.attendee and log.attendee.department else None,
                attendee_type=log.attendee.attendee_type.value if log.attendee else None,
                verified_at=log.verified_at.isoformat(),
                verification_method=log.verification_method.value,
                confidence_score=log.confidence_score,
                marshal_id=str(log.marshal_id) if log.marshal_id else None,
                created_at=log.created_at.isoformat(),
            )
        )
    return result


@router.get("/attendees/{attendee_id}/logs")
async def list_attendee_logs(
    attendee_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    logs = await attendance_service.get_attendee_logs(session, attendee_id)
    return [
        AttendanceLogResponse(
            id=str(log.id),
            session_id=str(log.session_id),
            attendee_id=str(log.attendee_id),
            attendee_name=f"{log.attendee.first_name} {log.attendee.last_name}" if log.attendee else None,
            verified_at=log.verified_at.isoformat(),
            verification_method=log.verification_method.value,
            confidence_score=log.confidence_score,
            marshal_id=str(log.marshal_id) if log.marshal_id else None,
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]


@router.get("/sessions/{session_id}/summary", response_model=AttendanceSummary)
async def session_summary(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    att_session = await attendance_service.get_session_for_attendance(session, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    present = await attendance_service.count_present(session, session_id)

    total_result = await session.execute(select(func.count(Attendee.id)))
    total_attendees = total_result.scalar() or 0

    return AttendanceSummary(
        session_id=str(att_session.id),
        session_name=att_session.name,
        total_attendees=total_attendees,
        present_count=present,
        absent_count=total_attendees - present,
    )


async def _get_attendee_for_user(session: AsyncSession, user: User) -> Attendee | None:
    result = await session.execute(select(Attendee).where(Attendee.user_id == user.id))
    return result.scalar_one_or_none()
