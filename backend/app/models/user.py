import enum
import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    org_admin = "org_admin"
    marshal = "marshal"
    staff = "staff"
    student = "student"
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ORG_ADMIN = "org_admin"
    MARSHAL = "marshal"
    STAFF = "staff"
    STUDENT = "student"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.lower()
            for member in cls:
                if member.value == val_lower or member.name.lower() == val_lower:
                    return member
        return cls.student


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, native_enum=False, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    institution = relationship("Institution", back_populates="users")
    attendees = relationship("Attendee", back_populates="user")
