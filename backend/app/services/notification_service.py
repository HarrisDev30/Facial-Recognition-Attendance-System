import uuid
from datetime import UTC, datetime

from app.models.attendee import Attendee
from app.models.notification import Notification, NotificationType
from app.models.organization_staff import OrganizationStaff
from app.models.user import User, UserRole
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession


async def create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.system_announcement,
    link_url: str | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        is_read=False,
        link_url=link_url,
    )
    session.add(notif)
    await session.flush()
    return notif


async def notify_department_admins(
    session: AsyncSession,
    organization_id: uuid.UUID,
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.cohost_invite,
    link_url: str | None = None,
):
    # Find org_admin users linked via OrganizationStaff
    staff_stmt = select(OrganizationStaff.user_id).where(
        OrganizationStaff.organization_id == organization_id
    )
    staff_res = await session.execute(staff_stmt)
    user_ids = set(staff_res.scalars().all())

    # Also find org_admin users linked via Attendee
    att_stmt = select(Attendee.user_id).where(
        Attendee.organization_id == organization_id,
        Attendee.user_id.isnot(None),
    )
    att_res = await session.execute(att_stmt)
    for uid in att_res.scalars().all():
        if uid:
            user_ids.add(uid)

    # Filter for users with role == org_admin or admin
    if user_ids:
        users_stmt = select(User.id).where(
            User.id.in_(list(user_ids)),
            User.role.in_([UserRole.org_admin, UserRole.admin, UserRole.ORG_ADMIN, UserRole.ADMIN]),
        )
        final_users_res = await session.execute(users_stmt)
        target_user_ids = final_users_res.scalars().all()
        for uid in target_user_ids:
            await create_notification(
                session=session,
                user_id=uid,
                title=title,
                message=message,
                notification_type=notification_type,
                link_url=link_url,
            )


async def notify_target_students(
    session: AsyncSession,
    organization_ids: list[uuid.UUID],
    title: str,
    message: str,
    notification_type: NotificationType = NotificationType.event_announcement,
    link_url: str | None = None,
):
    if not organization_ids:
        # All students
        att_stmt = select(Attendee.user_id).where(Attendee.user_id.isnot(None))
    else:
        att_stmt = select(Attendee.user_id).where(
            Attendee.organization_id.in_(organization_ids),
            Attendee.user_id.isnot(None),
        )
    att_res = await session.execute(att_stmt)
    target_user_ids = set(att_res.scalars().all())
    for uid in target_user_ids:
        if uid:
            await create_notification(
                session=session,
                user_id=uid,
                title=title,
                message=message,
                notification_type=notification_type,
                link_url=link_url,
            )


async def get_user_notifications(
    session: AsyncSession, user_id: uuid.UUID, limit: int = 50
) -> tuple[list[Notification], int]:
    # Query notifications
    query = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    res = await session.execute(query)
    items = list(res.scalars().all())

    # Count unread
    count_query = select(func.count(Notification.id)).where(
        Notification.user_id == user_id,
        Notification.is_read == False,
    )
    count_res = await session.execute(count_query)
    unread_count = count_res.scalar() or 0

    return items, unread_count


async def mark_as_read(
    session: AsyncSession, user_id: uuid.UUID, notification_id: uuid.UUID
) -> bool:
    notif = await session.get(Notification, notification_id)
    if notif and notif.user_id == user_id:
        notif.is_read = True
        await session.flush()
        return True
    return False


async def mark_all_as_read(session: AsyncSession, user_id: uuid.UUID) -> int:
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
        .values(is_read=True)
    )
    res = await session.execute(stmt)
    await session.flush()
    return res.rowcount
