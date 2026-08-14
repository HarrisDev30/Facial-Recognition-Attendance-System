from datetime import datetime

from app.database import get_session
from app.middleware.auth import require_admin_or_marshal, require_marshal
from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.models.attendance_session import AttendanceSession
from app.models.attendee import Attendee
from app.models.event import Event
from app.models.user import User
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

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

    model_config = {"from_attributes": True}


@router.get("/sessions/active", response_model=list[ActiveSessionResponse])
async def get_active_sessions(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_or_marshal),
):
    from sqlalchemy import func

    subq = (
        select(
            AttendanceLog.session_id,
            func.count(AttendanceLog.id).label("checked_in_count"),
        )
        .group_by(AttendanceLog.session_id)
        .subquery()
    )

    result = await db.execute(
        select(AttendanceSession, Event, subq.c.checked_in_count)
        .join(Event, AttendanceSession.event_id == Event.id)
        .outerjoin(subq, AttendanceSession.id == subq.c.session_id)
        .where(AttendanceSession.status == "active")
        .order_by(Event.start_date.desc(), AttendanceSession.start_time)
    )
    rows = result.all()

    total_registered_result = await db.execute(select(func.count(Attendee.id)))
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
