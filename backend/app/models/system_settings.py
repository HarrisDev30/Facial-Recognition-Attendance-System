import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False, default="default")
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    announcement: Mapped[str] = mapped_column(Text, default="", nullable=False)
    target_campus: Mapped[str] = mapped_column(String(50), default="all", nullable=False)
    banner_type: Mapped[str] = mapped_column(String(20), default="orange", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
