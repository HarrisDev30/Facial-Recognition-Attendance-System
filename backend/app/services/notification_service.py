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
    exclude_user_id: uuid.UUID | None = None,
):
    user_ids = set()

    # 1. OrganizationStaff for co-hosting department
    staff_res = await session.execute(
        select(OrganizationStaff.user_id).where(
            OrganizationStaff.organization_id == organization_id
        )
    )
    for uid in staff_res.scalars().all():
        if uid:
            user_ids.add(uid)

    # 2. Attendee for co-hosting department
    att_res = await session.execute(
        select(Attendee.user_id).where(
            Attendee.organization_id == organization_id,
            Attendee.user_id.isnot(None),
        )
    )
    for uid in att_res.scalars().all():
        if uid:
            user_ids.add(uid)

    # 3. Department Admins matching role for target department
    target_admin_ids = set()
    if user_ids:
        admin_res = await session.execute(
            select(User.id).where(
                User.id.in_(list(user_ids)),
                User.role.in_([UserRole.org_admin, UserRole.admin, UserRole.ORG_ADMIN, UserRole.ADMIN])
            )
        )
        for uid in admin_res.scalars().all():
            if uid:
                target_admin_ids.add(uid)

    # If no specific staff found, find admins matching organization
    if not target_admin_ids:
        admin_res = await session.execute(
            select(User.id).where(
                User.role.in_([UserRole.org_admin, UserRole.admin, UserRole.ORG_ADMIN, UserRole.ADMIN])
            )
        )
        for uid in admin_res.scalars().all():
            if uid:
                target_admin_ids.add(uid)

    # Exclude creator user ID
    if exclude_user_id and exclude_user_id in target_admin_ids:
        target_admin_ids.remove(exclude_user_id)

    for uid in target_admin_ids:
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
    exclude_user_id: uuid.UUID | None = None,
):
    if not organization_ids:
        att_stmt = select(Attendee.user_id).where(Attendee.user_id.isnot(None))
    else:
        att_stmt = select(Attendee.user_id).where(
            Attendee.organization_id.in_(organization_ids),
            Attendee.user_id.isnot(None),
        )
    att_res = await session.execute(att_stmt)
    target_user_ids = set(att_res.scalars().all())

    # Exclude caller (event creator)
    if exclude_user_id and exclude_user_id in target_user_ids:
        target_user_ids.remove(exclude_user_id)

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
