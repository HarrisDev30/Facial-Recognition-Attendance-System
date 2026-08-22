import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    organizations = relationship("Organization", back_populates="institution", cascade="all, delete-orphan")
    users = relationship("User", back_populates="institution", cascade="all, delete-orphan")
    attendees = relationship("Attendee", back_populates="institution", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="institution", cascade="all, delete-orphan")
    scanner_devices = relationship("ScannerDevice", back_populates="institution", cascade="all, delete-orphan")
