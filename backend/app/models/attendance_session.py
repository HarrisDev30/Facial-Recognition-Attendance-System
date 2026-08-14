import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, Float, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class SessionStatus(enum.StrEnum):
    pending = "pending"
    active = "active"
    completed = "completed"


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("events.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    venue: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus, name="session_status", create_constraint=True),
        nullable=False,
        default=SessionStatus.pending,
    )
    confidence_threshold: Mapped[float] = mapped_column(Float, default=0.72)
    detection_zone: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    deactivated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    event = relationship("Event", back_populates="sessions")
    attendance_logs = relationship(
        "AttendanceLog", back_populates="session", cascade="all, delete-orphan"
    )
