from datetime import datetime
import uuid

from app.database import get_session
from app.middleware.auth import DomainScope, get_domain_scope, require_marshal
from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.attendee import Attendee
from app.models.event import Event, EventStatus, EventTargetScope
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

router = APIRouter(prefix="/api/marshal", tags=["marshal"])


class MarshalOverrideResponse(BaseModel):
    id: str
    attendee_name: str | None
    session_name: str | None
    event_name: str | None
    reason: str | None
    timestamp: datetime

    model_config = {"from_attributes": True}


class ActiveSessionResponse(BaseModel):
    session_id: str
    session_name: str
    event_id: str
    event_name: str
    event_type: str | None
    venue: str | None
    start_time: datetime
    end_time: datetime
    checked_in_count: int | None = None
    total_registered: int | None = None
    organization_id: str | None = None

    model_config = {"from_attributes": True}


class UpcomingSessionItem(BaseModel):
    id: str
    name: str
    venue: str | None = None
    start_time: datetime
    end_time: datetime
    status: str


class MarshalUpcomingEventResponse(BaseModel):
    id: str
    name: str
    event_type: str | None = None
    venue: str | None = None
    start_date: str
    end_date: str
    organization_name: str | None = None
    photo_url: str | None = None
    sessions: list[UpcomingSessionItem]


@router.get("/events/upcoming", response_model=list[MarshalUpcomingEventResponse])
async def get_marshal_upcoming_events(
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher and not scope.is_marshal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Marshal or Admin privileges required",
        )

    today = datetime.now().date()
    query = (
        select(Event)
        .options(
            joinedload(Event.organization),
            selectinload(Event.sessions),
        )
        .where(
            Event.status != EventStatus.cancelled,
            Event.end_date >= today,
        )
    )

    if not scope.is_super_admin and scope.institution_id:
        query = query.where(Event.institution_id == scope.institution_id)

    if scope.is_marshal or scope.is_org_admin:
        if scope.assigned_org_ids:
            from sqlalchemy import String, cast
            cohost_clauses = [
                cast(Event.co_host_dept_ids, String).like(f"%{org_id}%")
                for org_id in scope.assigned_org_ids
            ]
            query = query.where(
                or_(
                    Event.organization_id.in_(scope.assigned_org_ids),
                    Event.organization_id == None,
                    Event.target_scope.in_([EventTargetScope.all, EventTargetScope.ALL, "all"]),
                    *cohost_clauses,
                )
            )

    query = query.order_by(Event.start_date.asc())
    res = await db.execute(query)
    events = res.unique().scalars().all()

    return [
        MarshalUpcomingEventResponse(
            id=str(ev.id),
            name=ev.name,
            event_type=ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type) if ev.event_type else None,
            venue=ev.venue,
            start_date=ev.start_date.isoformat(),
            end_date=ev.end_date.isoformat(),
            organization_name=ev.organization.name if ev.organization else "Campus Wide",
            photo_url=ev.photo_url,
            sessions=[
                UpcomingSessionItem(
                    id=str(sess.id),
                    name=sess.name,
                    venue=sess.venue,
                    start_time=sess.start_time,
                    end_time=sess.end_time,
                    status=sess.status.value if hasattr(sess.status, "value") else str(sess.status),
                )
                for sess in (ev.sessions or [])
            ],
        )
        for ev in events
    ]


@router.get("/sessions/active", response_model=list[ActiveSessionResponse])
async def get_active_sessions(
    organization_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher and not scope.is_marshal:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Marshal or Admin privileges required to view active scanner sessions",
        )

    subq = (
        select(
            AttendanceLog.session_id,
            func.count(AttendanceLog.id).label("checked_in_count"),
        )
        .group_by(AttendanceLog.session_id)
        .subquery()
    )

    query = (
        select(AttendanceSession, Event, subq.c.checked_in_count)
        .join(Event, AttendanceSession.event_id == Event.id)
        .outerjoin(subq, AttendanceSession.id == subq.c.session_id)
        .where(
            or_(
                AttendanceSession.status == SessionStatus.active,
                AttendanceSession.status == "active",
            )
        )
    )

    # 1. Enforce Institution isolation
    if not scope.is_super_admin and scope.institution_id:
        query = query.where(Event.institution_id == scope.institution_id)

    # 2. Enforce Department / Organization scoping for scoped Marshals and Org Admins
    if scope.is_marshal or scope.is_org_admin:
        if scope.assigned_org_ids:
            from sqlalchemy import String, cast
            cohost_clauses = [
                cast(Event.co_host_dept_ids, String).like(f"%{str(org_id)}%")
                for org_id in scope.assigned_org_ids
            ]
            query = query.where(
                or_(
                    Event.organization_id.in_(scope.assigned_org_ids),
                    Event.organization_id == None,
                    Event.target_scope.in_([EventTargetScope.all, EventTargetScope.ALL, "all"]),
                    *cohost_clauses,
                )
            )

    # 3. Enforce explicit organization filter if requested
    if organization_id:
        query = query.where(Event.organization_id == organization_id)

    query = query.order_by(Event.start_date.desc(), AttendanceSession.start_time)
    result = await db.execute(query)
    rows = result.all()

    att_count_q = select(func.count(Attendee.id))
    if not scope.is_super_admin and scope.institution_id:
        att_count_q = att_count_q.where(Attendee.institution_id == scope.institution_id)
    if organization_id:
        att_count_q = att_count_q.where(Attendee.organization_id == organization_id)
    elif (scope.is_marshal or scope.is_org_admin) and scope.assigned_org_ids:
        att_count_q = att_count_q.where(Attendee.organization_id.in_(scope.assigned_org_ids))
    total_registered_result = await db.execute(att_count_q)
    total_registered_val = total_registered_result.scalar() or 0

    return [
        ActiveSessionResponse(
            session_id=str(row[0].id),
            session_name=row[0].name,
            event_id=str(row[1].id),
            event_name=row[1].name,
            event_type=row[1].event_type,
            venue=row[1].venue,
            start_time=row[0].start_time,
            end_time=row[0].end_time,
            checked_in_count=row[2] or 0,
            total_registered=total_registered_val,
            organization_id=str(row[1].organization_id) if row[1].organization_id else None,
        )
        for row in rows
    ]


@router.get("/overrides", response_model=list[MarshalOverrideResponse])
async def get_my_overrides(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_marshal),
):
    result = await db.execute(
        select(AttendanceLog)
        .options(
            joinedload(AttendanceLog.attendee),
            joinedload(AttendanceLog.session).joinedload(AttendanceSession.event),
        )
        .where(
            AttendanceLog.marshal_id == current_user.id,
            AttendanceLog.verification_method == VerificationMethod.marshal_override,
        )
        .order_by(AttendanceLog.created_at.desc())
        .limit(20)
    )
    logs = result.unique().scalars().all()

    return [
        MarshalOverrideResponse(
            id=str(log.id),
            attendee_name=log.attendee.first_name + " " + log.attendee.last_name
            if log.attendee
            else None,
            session_name=log.session.name if log.session else None,
            event_name=log.session.event.name if log.session and log.session.event else None,
            reason=log.reason,
            timestamp=log.verified_at,
        )
        for log in logs
    ]


class MarshalShiftStatsResponse(BaseModel):
    total_verified_today: int
    face_count: int
    qr_count: int
    override_count: int
    active_sessions_count: int
    recent_sync_time: datetime


@router.get("/stats/shift", response_model=MarshalShiftStatsResponse)
async def get_marshal_shift_stats(
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
    current_user: User = Depends(require_marshal),
):
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 1. Total verified today by this marshal or in their assigned department sessions
    stmt = (
        select(
            AttendanceLog.verification_method,
            func.count(AttendanceLog.id)
        )
        .where(
            AttendanceLog.verified_at >= today_start,
            or_(
                AttendanceLog.marshal_id == current_user.id,
                AttendanceLog.session_id.in_(
                    select(AttendanceSession.id)
                    .join(Event, AttendanceSession.event_id == Event.id)
                    .where(Event.organization_id.in_(scope.assigned_org_ids) if scope.assigned_org_ids else True)
                )
            )
        )
        .group_by(AttendanceLog.verification_method)
    )
    res = await db.execute(stmt)
    rows = dict(res.all())

    face_count = rows.get(VerificationMethod.face_recognition, 0)
    qr_count = rows.get(VerificationMethod.qr_code, 0)
    override_count = rows.get(VerificationMethod.marshal_override, 0)
    total_today = face_count + qr_count + override_count

    # Active sessions in scope
    active_sess_stmt = (
        select(func.count(AttendanceSession.id))
        .join(Event, AttendanceSession.event_id == Event.id)
        .where(
            or_(
                AttendanceSession.status == SessionStatus.active,
                AttendanceSession.status == "active",
            )
        )
    )
    if not scope.is_super_admin and scope.institution_id:
        active_sess_stmt = active_sess_stmt.where(Event.institution_id == scope.institution_id)
    if scope.assigned_org_ids:
        active_sess_stmt = active_sess_stmt.where(
            or_(
                Event.organization_id.in_(scope.assigned_org_ids),
                Event.organization_id == None,
                Event.target_scope.in_([EventTargetScope.all, EventTargetScope.ALL, "all"]),
            )
        )
    
    sess_res = await db.execute(active_sess_stmt)
    active_sessions_count = sess_res.scalar() or 0

    return MarshalShiftStatsResponse(
        total_verified_today=total_today,
        face_count=face_count,
        qr_count=qr_count,
        override_count=override_count,
        active_sessions_count=active_sessions_count,
        recent_sync_time=datetime.now(),
    )


class ManualOverrideCreateRequest(BaseModel):
    session_id: str
    attendee_id: str | None = None
    student_identifier: str | None = None
    reason_tag: str
    notes: str | None = None


@router.post("/override")
async def create_manual_override(
    body: ManualOverrideCreateRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_marshal),
):
    import uuid

    # Resolve Session
    try:
        sess_id = uuid.UUID(body.session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session_id format")

    session_obj = await db.get(AttendanceSession, sess_id)
    if not session_obj:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    # Resolve Attendee
    attendee = None
    if body.attendee_id:
        try:
            att_id = uuid.UUID(body.attendee_id)
            attendee = await db.get(Attendee, att_id)
        except ValueError:
            pass
    
    if not attendee and body.student_identifier:
        res = await db.execute(
            select(Attendee).where(Attendee.identifier == body.student_identifier.strip())
        )
        attendee = res.scalar_one_or_none()

    if not attendee:
        raise HTTPException(status_code=404, detail="Student attendee not found")

    # Check if already logged for this session
    existing = await db.execute(
        select(AttendanceLog).where(
            AttendanceLog.session_id == session_obj.id,
            AttendanceLog.attendee_id == attendee.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Student already checked in for this session")

    # Combine tag and optional notes
    full_reason = f"[{body.reason_tag}] {body.notes or ''}".strip()

    log = AttendanceLog(
        id=uuid.uuid4(),
        session_id=session_obj.id,
        attendee_id=attendee.id,
        verified_at=datetime.now(),
        verification_method=VerificationMethod.marshal_override,
        confidence_score=1.0,
        marshal_id=current_user.id,
        reason=full_reason,
    )
    db.add(log)
    await db.commit()

    return {
        "status": "success",
        "message": f"Successfully verified {attendee.first_name} {attendee.last_name}",
        "attendee_name": f"{attendee.first_name} {attendee.last_name}",
        "student_identifier": attendee.identifier,
        "verified_at": log.verified_at.isoformat(),
    }


class BatchScanItem(BaseModel):
    session_id: str
    attendee_id: str
    verification_method: str = "face_recognition"
    confidence_score: float | None = None
    verified_at: datetime | None = None
    reason: str | None = None


class BatchSyncRequest(BaseModel):
    scans: list[BatchScanItem]


@router.post("/sync-batch")
async def sync_offline_scans_batch(
    body: BatchSyncRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_marshal),
):
    import uuid

    synced_count = 0
    duplicate_count = 0

    for item in body.scans:
        try:
            s_id = uuid.UUID(item.session_id)
            a_id = uuid.UUID(item.attendee_id)
        except ValueError:
            continue

        # Check existing
        existing = await db.execute(
            select(AttendanceLog.id).where(
                AttendanceLog.session_id == s_id,
                AttendanceLog.attendee_id == a_id,
            )
        )
        if existing.scalar_one_or_none():
            duplicate_count += 1
            continue

        verif_method = VerificationMethod.face_recognition
        if item.verification_method == "qr_code":
            verif_method = VerificationMethod.qr_code
        elif item.verification_method == "marshal_override":
            verif_method = VerificationMethod.marshal_override

        log = AttendanceLog(
            id=uuid.uuid4(),
            session_id=s_id,
            attendee_id=a_id,
            verified_at=item.verified_at or datetime.now(),
            verification_method=verif_method,
            confidence_score=item.confidence_score,
            marshal_id=current_user.id if verif_method == VerificationMethod.marshal_override else None,
            reason=item.reason,
        )
        db.add(log)
        synced_count += 1

    await db.commit()

    return {
        "status": "success",
        "synced_count": synced_count,
        "duplicate_count": duplicate_count,
        "total_received": len(body.scans),
    }
