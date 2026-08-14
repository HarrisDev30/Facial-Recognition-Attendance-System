import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class MemberType(str, enum.Enum):
    STUDENT = "student"
    FACULTY = "faculty"
    STAFF = "staff"


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "attendee_id", name="uq_organization_attendee"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendees.id", ondelete="CASCADE"), nullable=False
    )
    member_type: Mapped[MemberType] = mapped_column(
        Enum(MemberType, native_enum=False), default=MemberType.STUDENT, nullable=False
    )
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g., "President", "Member", "Faculty Advisor"
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    organization = relationship("Organization", back_populates="memberships")
    attendee = relationship("Attendee", back_populates="memberships")
