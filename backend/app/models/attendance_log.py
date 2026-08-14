import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, Float, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class VerificationMethod(enum.StrEnum):
    face_recognition = "face_recognition"
    qr_code = "qr_code"
    marshal_override = "marshal_override"


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendance_sessions.id"), nullable=False
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendees.id"), nullable=False
    )
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    verification_method: Mapped[VerificationMethod] = mapped_column(
        SAEnum(
            VerificationMethod, name="verification_method", create_constraint=True
        ),
        nullable=False,
    )
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    marshal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    session = relationship("AttendanceSession", back_populates="attendance_logs")
    attendee = relationship("Attendee", back_populates="attendance_logs")

    __table_args__ = (
        UniqueConstraint("session_id", "attendee_id", name="uq_attendance_log_session_attendee"),
        Index("ix_attendance_logs_attendee_verified", "attendee_id", "verified_at"),
    )
