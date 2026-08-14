import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class AttendeeType(str, enum.Enum):
    student = "student"
    faculty = "faculty"
    staff = "staff"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return cls.student


class Attendee(Base):
    __tablename__ = "attendees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    attendee_type: Mapped[AttendeeType] = mapped_column(
        SAEnum(AttendeeType, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        default=AttendeeType.student,
        nullable=False,
    )
    identifier: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    profile_photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_given_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user = relationship("User", back_populates="attendees")
    organization = relationship("Organization", back_populates="attendees")
    memberships = relationship("Membership", back_populates="attendee", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="attendee")
    attendance_logs = relationship("AttendanceLog", back_populates="attendee")
