import uuid

from app.database import async_session_factory
from app.models.audit_log import AuditLog
from sqlalchemy import select


async def log_action(
    action: str,
    resource_type: str,
    resource_id: str | None = None,
    user_id: str | uuid.UUID | None = None,
    ip_address: str | None = None,
    details: str | None = None,
) -> AuditLog:
    async with async_session_factory() as session:
        log = AuditLog(
            user_id=uuid.UUID(str(user_id)) if user_id else None,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            ip_address=ip_address,
            details=details,
        )
        session.add(log)
        await session.commit()
        await session.refresh(log)
        return log


async def get_audit_logs(
    resource_type: str | None = None,
    action: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[AuditLog]:
    async with async_session_factory() as session:
        query = select(AuditLog).order_by(AuditLog.timestamp.desc())

        if resource_type:
            query = query.where(AuditLog.resource_type == resource_type)
        if action:
            query = query.where(AuditLog.action == action)

        query = query.offset(offset).limit(limit)
        result = await session.execute(query)
        return list(result.scalars().all())
