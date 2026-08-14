from datetime import datetime

from pydantic import BaseModel, Field


class AttendeeProfileResponse(BaseModel):
    id: str
    email: str
    first_name: str | None = None
    last_name: str | None = None
    identifier: str | None = None
    attendee_type: str | None = None
    organization_id: str | None = None
    department_id: str | None = None
    department_code: str | None = None
    department_name: str | None = None
    created_at: datetime
    registration_status: str = "not_registered"
    num_embeddings: int = 0
    consent_given: bool = False
    profile_photo_url: str | None = None

    model_config = {"from_attributes": True}


class AttendeeProfileUpdate(BaseModel):
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    identifier: str | None = Field(None, max_length=50)
    organization_id: str | None = Field(None, max_length=36)
    department_id: str | None = Field(None, max_length=36)


class ConsentRequest(BaseModel):
    consent_given: bool
    acknowledge_data_privacy: bool


class ConsentResponse(BaseModel):
    success: bool
    consent_id: str
    consent_date: datetime


class ConsentStatusResponse(BaseModel):
    has_consented: bool
    consent_date: datetime | None = None
    consent_version: str | None = None


class DataRemovalRequestResponse(BaseModel):
    success: bool
    request_id: str


class DataRemovalRequestBody(BaseModel):
    reason: str | None = None
