import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class OrgType(str, enum.Enum):
    COLLEGE = "college"
    CLUB = "club"
    OFFICE = "office"


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="uq_organization_institution_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    org_type: Mapped[OrgType] = mapped_column(
        Enum(OrgType, native_enum=False), default=OrgType.COLLEGE, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    institution = relationship("Institution", back_populates="organizations")
    parent = relationship("Organization", remote_side=[id], back_populates="children")
    children = relationship("Organization", back_populates="parent", cascade="all, delete-orphan")
    attendees = relationship("Attendee", back_populates="organization")
    events = relationship("Event", back_populates="organization")
    memberships = relationship("Membership", back_populates="organization", cascade="all, delete-orphan")
    staff = relationship("OrganizationStaff", back_populates="organization", cascade="all, delete-orphan")
