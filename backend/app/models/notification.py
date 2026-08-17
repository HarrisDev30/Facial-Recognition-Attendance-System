import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class NotificationType(str, enum.Enum):
    cohost_invite = "cohost_invite"
    event_announcement = "event_announcement"
    attendance_checkin = "attendance_checkin"
    system_announcement = "system_announcement"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        SAEnum(NotificationType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=NotificationType.system_announcement,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User", backref="notifications")
