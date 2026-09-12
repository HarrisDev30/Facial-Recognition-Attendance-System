from datetime import datetime

from pydantic import BaseModel, Field


class AttendeeCreate(BaseModel):
    identifier: str = Field(..., max_length=50)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: str | None = Field(None, max_length=255)
    department_id: str = Field(..., max_length=36)
    attendee_type: str = Field("student", pattern=r"^(student|staff)$")


class AttendeeResponse(BaseModel):
    id: str
    identifier: str
    first_name: str
    last_name: str
    email: str | None
    attendee_type: str
    department_id: str
    department_name: str | None = None
    department_code: str | None = None
    consent_given: bool
    consent_given_at: datetime | None
    profile_photo_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class EmbeddingUploadResponse(BaseModel):
    attendee_id: str
    embedding_id: str
    camera_angle: str | None
    message: str


class RegistrationStatusResponse(BaseModel):
    is_registered: bool
    num_embeddings: int
    can_register: bool
    last_registration: datetime | None = None


class EmbeddingUploadResult(BaseModel):
    success: bool
    embedding_id: str
    num_embeddings: int
    message: str


class EmbeddingDeleteResult(BaseModel):
    success: bool
    remaining_embeddings: int


class RegistrationResetResult(BaseModel):
    success: bool
    status: str = "not_registered"
