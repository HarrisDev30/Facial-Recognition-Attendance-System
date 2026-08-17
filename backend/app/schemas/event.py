from datetime import date

from pydantic import BaseModel, Field


class EventCreate(BaseModel):
    name: str = Field(..., max_length=200)
    event_type: str = Field(
        ..., pattern=r"^(intramurals|seminar|workshop|conference|campus_activity|assembly|club_event)$"
    )
    description: str | None = None
    venue: str | None = Field(None, max_length=200)
    start_date: date
    end_date: date
    organization_id: str | None = None
    department_id: str | None = None
    photo_url: str | None = None
    target_scope: str = Field(
        "department_only", pattern=r"^(all|department_only|selected_departments)$"
    )
    co_host_dept_ids: list[str] | None = None


class EventUpdate(BaseModel):
    name: str | None = Field(None, max_length=200)
    event_type: str | None = Field(
        None, pattern=r"^(intramurals|seminar|workshop|conference|campus_activity|assembly|club_event)$"
    )
    description: str | None = None
    venue: str | None = Field(None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = Field(
        None, pattern=r"^(draft|active|completed|cancelled)$"
    )
    organization_id: str | None = None
    department_id: str | None = None
    photo_url: str | None = None
    target_scope: str | None = Field(
        None, pattern=r"^(all|department_only|selected_departments)$"
    )
    co_host_dept_ids: list[str] | None = None


class EventResponse(BaseModel):
    id: str
    name: str
    event_type: str
    description: str | None
    venue: str | None
    start_date: date
    end_date: date
    status: str
    organization_id: str | None = None
    organization_code: str | None = None
    organization_name: str | None = None
    department_id: str | None = None
    department_code: str | None = None
    created_by: str
    created_at: str
    updated_at: str
    photo_url: str | None = None
    target_scope: str = "department_only"
    co_host_dept_ids: list[str] | None = None

    model_config = {"from_attributes": True}


class EventListResponse(BaseModel):
    items: list[EventResponse]
    total: int
