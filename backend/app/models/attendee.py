import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
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
    __table_args__ = (
        UniqueConstraint("institution_id", "identifier", name="uq_attendee_institution_identifier"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True
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
    identifier: Mapped[str] = mapped_column(String(50), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    profile_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_given_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    institution = relationship("Institution", back_populates="attendees")
    user = relationship("User", back_populates="attendees")
    organization = relationship("Organization", back_populates="attendees")
    memberships = relationship("Membership", back_populates="attendee", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="attendee")
    attendance_logs = relationship("AttendanceLog", back_populates="attendee")
