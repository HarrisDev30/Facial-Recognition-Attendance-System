import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class OrgType(str, enum.Enum):
    COLLEGE = "college"
    CLUB = "club"
    OFFICE = "office"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    org_type: Mapped[OrgType] = mapped_column(
        Enum(OrgType, native_enum=False), default=OrgType.COLLEGE, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    attendees = relationship("Attendee", back_populates="organization")
    events = relationship("Event", back_populates="organization")
    memberships = relationship("Membership", back_populates="organization", cascade="all, delete-orphan")
    staff = relationship("OrganizationStaff", back_populates="organization", cascade="all, delete-orphan")
