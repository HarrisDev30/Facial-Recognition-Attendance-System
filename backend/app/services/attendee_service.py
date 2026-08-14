import uuid

from app.models.attendee import Attendee
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload


async def create_attendee(
    session: AsyncSession, data: dict
) -> Attendee:
    attendee = Attendee(**data)
    session.add(attendee)
    await session.flush()
    return attendee


async def get_attendees(
    session: AsyncSession, skip: int = 0, limit: int = 100
) -> list[Attendee]:
    result = await session.execute(
        select(Attendee)
        .options(joinedload(Attendee.organization))
        .order_by(Attendee.last_name, Attendee.first_name)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_attendees(session: AsyncSession) -> int:
    result = await session.execute(select(func.count(Attendee.id)))
    return result.scalar()


async def get_attendee(session: AsyncSession, attendee_id: uuid.UUID) -> Attendee | None:
    result = await session.execute(
        select(Attendee).where(Attendee.id == attendee_id).options(joinedload(Attendee.organization))
    )
    return result.scalar_one_or_none()


async def get_attendee_by_identifier(
    session: AsyncSession, identifier: str
) -> Attendee | None:
    result = await session.execute(
        select(Attendee).where(Attendee.identifier == identifier)
    )
    return result.scalar_one_or_none()


async def update_attendee(
    session: AsyncSession, attendee_id: uuid.UUID, data: dict
) -> Attendee | None:
    attendee = await session.get(Attendee, attendee_id)
    if attendee is None:
        return None
    ALLOWED_UPDATE_FIELDS = {
        "first_name", "last_name", "email", "identifier",
        "organization_id", "department_id", "attendee_type", "consent_given", "consent_given_at",
    }

    for key, value in data.items():
        if key in ALLOWED_UPDATE_FIELDS and hasattr(attendee, key):
            setattr(attendee, key, value)
    await session.flush()
    return attendee


async def delete_attendee(session: AsyncSession, attendee_id: uuid.UUID) -> bool:
    attendee = await session.get(Attendee, attendee_id)
    if attendee is None:
        return False
    await session.delete(attendee)
    await session.flush()
    return True
