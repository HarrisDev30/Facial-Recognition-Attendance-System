import uuid
from datetime import datetime

from app.database import Base
from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    attendee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("attendees.id"), nullable=False
    )
    embedding: Mapped[bytes] = mapped_column(LargeBinary(2048), nullable=False)
    camera_angle: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lighting_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    attendee = relationship("Attendee", back_populates="embeddings")
