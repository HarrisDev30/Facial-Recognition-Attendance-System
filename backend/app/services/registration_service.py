import uuid
from datetime import UTC, datetime

from app.models.attendee import Attendee
from app.models.embedding import Embedding
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession


async def update_consent(
    session: AsyncSession, attendee_id: uuid.UUID, consent_given: bool
) -> Attendee | None:
    attendee = await session.get(Attendee, attendee_id)
    if attendee is None:
        return None
    attendee.consent_given = consent_given
    attendee.consent_given_at = datetime.now(UTC) if consent_given else None
    await session.flush()
    return attendee


async def get_embeddings(
    session: AsyncSession, attendee_id: uuid.UUID
) -> list[Embedding]:
    result = await session.execute(
        select(Embedding)
        .where(Embedding.attendee_id == attendee_id)
        .order_by(Embedding.created_at.desc())
    )
    return list(result.scalars().all())


async def save_embedding(
    session: AsyncSession,
    attendee_id: uuid.UUID,
    embedding_bytes: bytes,
    camera_angle: str | None = None,
) -> Embedding:
    emb = Embedding(
        attendee_id=attendee_id,
        embedding=embedding_bytes,
        camera_angle=camera_angle,
    )
    session.add(emb)
    await session.flush()
    return emb


async def count_embeddings(session: AsyncSession, attendee_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count(Embedding.id)).where(Embedding.attendee_id == attendee_id)
    )
    return result.scalar() or 0


async def delete_embedding(
    session: AsyncSession, attendee_id: uuid.UUID, embedding_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(Embedding).where(
            Embedding.id == embedding_id,
            Embedding.attendee_id == attendee_id,
        )
    )
    emb = result.scalar_one_or_none()
    if emb is None:
        return False
    await session.delete(emb)
    await session.flush()
    return True


async def delete_all_embeddings(session: AsyncSession, attendee_id: uuid.UUID) -> int:
    result = await session.execute(
        select(Embedding).where(Embedding.attendee_id == attendee_id)
    )
    embeddings = list(result.scalars().all())
    count = len(embeddings)
    for emb in embeddings:
        await session.delete(emb)
    await session.flush()
    return count
