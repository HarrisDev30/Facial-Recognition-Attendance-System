from datetime import datetime

from pydantic import BaseModel, Field


class SessionCreate(BaseModel):
    name: str = Field(..., max_length=200)
    venue: str | None = Field(None, max_length=200)
    start_time: datetime
    end_time: datetime
    confidence_threshold: float = 0.6
    detection_zone: dict | None = None


class SessionUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    venue: str | None = Field(None, max_length=200)
    start_time: datetime | None = None
    end_time: datetime | None = None
    status: str | None = Field(
        None, pattern=r"^(pending|active|completed)$"
    )
    confidence_threshold: float | None = None
    detection_zone: dict | None = None


class SessionResponse(BaseModel):
    id: str
    event_id: str
    name: str
    venue: str | None = None
    start_time: datetime
    end_time: datetime
    status: str
    confidence_threshold: float
    detection_zone: dict | None
    activated_at: datetime | None
    deactivated_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AttendanceLogResponse(BaseModel):
    id: str
    session_id: str
    attendee_id: str
    attendee_name: str | None = None
    department_name: str | None = None
    attendee_type: str | None = None
    verified_at: datetime
    verification_method: str
    confidence_score: float | None
    marshal_id: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class VerifyResult(BaseModel):
    identified: bool
    attendee_id: str | None = None
    attendee_name: str | None = None
    confidence_score: float | None = None
    verification_method: str | None = None
    message: str


class CheckInRequest(BaseModel):
    session_id: str
    attendee_id: str
    verification_method: str = Field(
        ..., pattern=r"^(face_recognition|qr_code|marshal_override)$"
    )
    confidence_score: float | None = None


class AttendanceSummary(BaseModel):
    session_id: str
    session_name: str
    total_attendees: int = 0
    present_count: int = 0
    absent_count: int = 0


class AttendeeAttendanceLogResponse(BaseModel):
    id: str
    event_name: str
    event_type: str | None = None
    session_name: str | None = None
    session_date: datetime | None = None
    check_in_time: datetime
    verification_method: str
    confidence_score: float | None = None
    venue: str | None = None

    model_config = {"from_attributes": True}


class AttendeeAttendanceSummary(BaseModel):
    total_events_attended: int = 0
    total_events_available: int = 0
    attendance_rate: float = 0.0
    last_attendance: datetime | None = None
    attendance_by_type: dict[str, int] = {}


class UpcomingEventResponse(BaseModel):
    id: str
    name: str
    event_type: str
    description: str | None = None
    venue: str | None = None
    date: str
    sessions_count: int = 0
    active_sessions_count: int = 0
    photo_url: str | None = None
    target_scope: str = "department_only"
    co_host_dept_ids: list[str] | None = None

    model_config = {"from_attributes": True}


class UpcomingEventListResponse(BaseModel):
    items: list[UpcomingEventResponse]
    total: int
    page: int
    size: int


class EventSessionAttendance(BaseModel):
    session_id: str
    session_name: str
    venue: str | None = None
    start_time: datetime
    end_time: datetime
    status: str | None = None
    verified_at: datetime | None = None
    verification_method: str | None = None
    confidence_score: float | None = None


class AttendeeEventAttendanceResponse(BaseModel):
    event_id: str
    event_name: str
    event_type: str
    description: str | None = None
    venue: str | None = None
    start_date: str
    end_date: str
    sessions: list[EventSessionAttendance] = []
