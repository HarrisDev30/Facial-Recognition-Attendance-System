import uuid

from app.database import get_session
from app.middleware.auth import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.services import notification_service
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_my_notifications(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    items, unread_count = await notification_service.get_user_notifications(
        session, current_user.id
    )
    return NotificationListResponse(
        items=[
            NotificationResponse(
                id=str(n.id),
                user_id=str(n.user_id),
                title=n.title,
                message=n.message,
                notification_type=n.notification_type.value
                if hasattr(n.notification_type, "value")
                else str(n.notification_type),
                is_read=n.is_read,
                link_url=n.link_url,
                created_at=n.created_at,
            )
            for n in items
        ],
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    ok = await notification_service.mark_as_read(session, current_user.id, notification_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Notification not found")
    await session.commit()
    return {"success": True}


@router.post("/read-all")
async def mark_all_notifications_read(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    count = await notification_service.mark_all_as_read(session, current_user.id)
    await session.commit()
    return {"success": True, "marked_read": count}
