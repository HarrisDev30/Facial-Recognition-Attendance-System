from datetime import datetime

from pydantic import BaseModel, Field


class FaceIdentification(BaseModel):
    index: int
    attendee_id: str | None = None
    attendee_name: str | None = None
    confidence_score: float | None = None
    already_checked_in: bool = False
    message: str
    bbox: list[int] = []


class FrameProcessResponse(BaseModel):
    face_count: int
    identified: bool
    new_checkin_count: int = 0
    identifications: list[FaceIdentification] = []


class QRCheckInRequest(BaseModel):
    session_id: str
    attendee_id: str | None = Field(None, max_length=50)
    token: str | None = Field(None, max_length=500)


class QRCheckInResponse(BaseModel):
    success: bool
    attendee_name: str | None = None
    message: str


class ManualOverrideRequest(BaseModel):
    session_id: str
    attendee_id: str = Field(..., max_length=50)
    reason: str | None = Field(None, max_length=500)


class ManualOverrideResponse(BaseModel):
    success: bool
    attendee_name: str | None = None
    message: str


class RecentCheckIn(BaseModel):
    attendee_name: str
    timestamp: datetime
    method: str


class LiveStatsResponse(BaseModel):
    total_checked_in: int = 0
    total_registered: int = 0
    check_in_rate: float = 0.0
    recent_check_ins: list[RecentCheckIn] = []
