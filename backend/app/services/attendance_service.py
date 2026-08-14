import uuid
from datetime import UTC, datetime

from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.models.attendance_session import AttendanceSession
from app.models.attendee import Attendee
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload


async def log_attendance(
    session: AsyncSession,
    session_id: uuid.UUID,
    attendee_id: uuid.UUID,
    verification_method: VerificationMethod,
    confidence_score: float | None = None,
    marshal_id: uuid.UUID | None = None,
    reason: str | None = None,
) -> AttendanceLog | None:
    att_log = AttendanceLog(
        session_id=session_id,
        attendee_id=attendee_id,
        verified_at=datetime.now(UTC),
        verification_method=verification_method,
        confidence_score=confidence_score,
        marshal_id=marshal_id,
        reason=reason,
    )
    session.add(att_log)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        return None
    return att_log


async def get_session_logs(
    session: AsyncSession, session_id: uuid.UUID
) -> list[AttendanceLog]:
    result = await session.execute(
        select(AttendanceLog)
        .where(AttendanceLog.session_id == session_id)
        .options(
            joinedload(AttendanceLog.attendee).joinedload(Attendee.department)
        )
        .order_by(AttendanceLog.verified_at.desc())
    )
    return list(result.scalars().all())


async def get_attendee_logs(
    session: AsyncSession, attendee_id: uuid.UUID
) -> list[AttendanceLog]:
    result = await session.execute(
        select(AttendanceLog)
        .where(AttendanceLog.attendee_id == attendee_id)
        .options(joinedload(AttendanceLog.attendee))
        .order_by(AttendanceLog.verified_at.desc())
    )
    return list(result.scalars().all())


async def count_present(
    session: AsyncSession, session_id: uuid.UUID
) -> int:
    result = await session.execute(
        select(func.count(func.distinct(AttendanceLog.attendee_id)))
        .where(AttendanceLog.session_id == session_id)
    )
    return result.scalar()


async def has_existing_log(
    session: AsyncSession,
    session_id: uuid.UUID,
    attendee_id: uuid.UUID,
) -> bool:
    result = await session.execute(
        select(func.count(AttendanceLog.id))
        .where(
            AttendanceLog.session_id == session_id,
            AttendanceLog.attendee_id == attendee_id,
        )
    )
    return result.scalar() > 0


async def get_session_for_attendance(
    session: AsyncSession, session_id: uuid.UUID
) -> AttendanceSession | None:
    return await session.get(AttendanceSession, session_id)
