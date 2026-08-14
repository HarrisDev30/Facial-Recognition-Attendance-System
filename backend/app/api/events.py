import os
import uuid

from app.config import settings
from app.database import get_session
from app.middleware.auth import get_current_user, require_admin, require_admin_or_marshal
from app.models.organization import Organization
from app.models.user import User
from app.schemas.attendance import UpcomingEventResponse, UpcomingEventListResponse
from app.schemas.event import (
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
)
from app.services import event_service
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/events", tags=["events"])


def _event_response(e) -> EventResponse:
    org_id_str = str(e.organization_id) if e.organization_id else None
    org_code = e.organization.code if hasattr(e, "organization") and e.organization else None
    org_name = e.organization.name if hasattr(e, "organization") and e.organization else None
    ev_type = e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type)
    ev_status = e.status.value if hasattr(e.status, "value") else str(e.status)

    return EventResponse(
        id=str(e.id),
        name=e.name,
        event_type=ev_type,
        description=e.description,
        venue=e.venue,
        start_date=e.start_date,
        end_date=e.end_date,
        status=ev_status,
        organization_id=org_id_str,
        organization_code=org_code,
        organization_name=org_name,
        department_id=org_id_str,
        department_code=org_code,
        created_by=str(e.created_by),
        created_at=e.created_at.isoformat(),
        updated_at=e.updated_at.isoformat(),
        photo_url=e.photo_url,
    )


@router.get("", response_model=EventListResponse)
async def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    organization_id: str | None = Query(None),
    department_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    org_filter = organization_id or department_id
    items = await event_service.get_events(session, skip=skip, limit=limit, organization_id=org_filter)
    total = await event_service.count_events(session, organization_id=org_filter)
    return EventListResponse(
        items=[_event_response(e) for e in items],
        total=total,
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin_or_marshal),
):
    data = body.model_dump()
    target_org_id = body.organization_id or body.department_id
    if target_org_id:
        org = await session.get(Organization, uuid.UUID(target_org_id))
        if org is None:
            raise HTTPException(status_code=404, detail="Organization not found")
        data["organization_id"] = uuid.UUID(target_org_id)
    else:
        res = await session.execute(select(Organization).limit(1))
        first_org = res.scalar_one_or_none()
        if not first_org:
            raise HTTPException(status_code=400, detail="No organization exists to assign event")
        data["organization_id"] = first_org.id

    if "department_id" in data:
        del data["department_id"]

    event = await event_service.create_event(session, data, user.id)
    return _event_response(event)


@router.get("/upcoming", response_model=UpcomingEventListResponse)
async def list_upcoming_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * size
    events_with_counts = await event_service.get_upcoming_events(session, skip=skip, limit=size)
    total = await event_service.count_upcoming_events(session)
    items = [
        UpcomingEventResponse(
            id=str(event.id),
            name=event.name,
            event_type=event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type),
            description=event.description,
            venue=event.venue,
            date=event.start_date.isoformat() if event.start_date else "",
            sessions_count=sessions_count,
            active_sessions_count=active_sessions_count,
            photo_url=event.photo_url,
        )
        for event, sessions_count, active_sessions_count in events_with_counts
    ]
    return UpcomingEventListResponse(items=items, total=total, page=page, size=size)


@router.get("/all", response_model=UpcomingEventListResponse)
async def list_all_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * size
    events_with_counts = await event_service.get_upcoming_events(session, skip=skip, limit=size)
    total = await event_service.count_upcoming_events(session)
    items = [
        UpcomingEventResponse(
            id=str(event.id),
            name=event.name,
            event_type=event.event_type.value if hasattr(event.event_type, "value") else str(event.event_type),
            description=event.description,
            venue=event.venue,
            date=event.start_date.isoformat() if event.start_date else "",
            sessions_count=sessions_count,
            active_sessions_count=active_sessions_count,
            photo_url=event.photo_url,
        )
        for event, sessions_count, active_sessions_count in events_with_counts
    ]
    return UpcomingEventListResponse(items=items, total=total, page=page, size=size)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    event = await event_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_response(event)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin_or_marshal),
):
    data = body.model_dump(exclude_unset=True)
    target_org_id = data.get("organization_id") or data.get("department_id")
    if target_org_id:
        data["organization_id"] = uuid.UUID(target_org_id)
    if "department_id" in data:
        del data["department_id"]

    event = await event_service.update_event(session, event_id, data)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return _event_response(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin_or_marshal),
):
    ok = await event_service.delete_event(session, event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    return None
