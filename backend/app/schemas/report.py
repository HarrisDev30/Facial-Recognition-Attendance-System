from pydantic import BaseModel


class AttendanceSummary(BaseModel):
    total_attendees: int
    total_present: int
    total_absent: int
    attendance_rate: float


class SessionReport(BaseModel):
    session_id: str
    session_name: str
    total_attendees: int
    total_present: int
    attendance_rate: float


class EventReport(BaseModel):
    event_id: str
    event_name: str
    sessions: list[SessionReport]
    overall_attendance_rate: float


class AttendeeReport(BaseModel):
    attendee_id: str
    attendee_name: str
    total_events: int
    events_attended: int
    attendance_rate: float
