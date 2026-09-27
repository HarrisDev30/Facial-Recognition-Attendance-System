import os
import uuid

from app.config import settings
from app.database import get_session
from app.middleware.auth import (
    DomainScope,
    get_current_user,
    get_domain_scope,
    require_admin,
    require_admin_or_marshal,
)
from app.models.attendee import Attendee
from app.models.organization import Organization
from app.models.user import User, UserRole
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
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/events", tags=["events"])


def _event_response(e, sessions_count: int = 0, active_sessions_count: int = 0) -> EventResponse:
    org_id_str = str(e.organization_id) if e.organization_id else None
    org = e.__dict__.get("organization")
    org_code = org.code if org else None
    org_name = org.name if org else None
    ev_type = e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type)
    ev_status = e.status.value if hasattr(e.status, "value") else str(e.status)
    target_scope_val = e.target_scope.value if hasattr(e.target_scope, "value") else str(e.target_scope or "department_only")

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
        target_scope=target_scope_val,
        co_host_dept_ids=e.co_host_dept_ids,
        sessions_count=sessions_count,
        active_sessions_count=active_sessions_count,
    )


@router.get("", response_model=EventListResponse)
async def list_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    organization_id: str | None = Query(None),
    department_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    inst_id = current_user.institution_id if current_user.role != UserRole.super_admin else None
    org_filter = organization_id or department_id
    if not org_filter and current_user.role not in (UserRole.admin, UserRole.super_admin):
        attendee_res = await session.execute(
            select(Attendee).where(Attendee.user_id == current_user.id)
        )
        att = attendee_res.scalar_one_or_none()
        if att and att.organization_id:
            org_filter = str(att.organization_id)

    items = await event_service.get_events(
        session, skip=skip, limit=limit, organization_id=org_filter, institution_id=inst_id
    )
    total = await event_service.count_events(
        session, organization_id=org_filter, institution_id=inst_id
    )
    return EventListResponse(
        items=[_event_response(e, s_cnt, act_s_cnt) for e, s_cnt, act_s_cnt in items],
        total=total,
    )


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_admin_or_marshal),
):
    data = body.model_dump()
    data["institution_id"] = user.institution_id
    target_org_id = body.organization_id or body.department_id
    if target_org_id:
        try:
            target_uuid = uuid.UUID(target_org_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid organization ID format")
        org = await session.get(Organization, target_uuid)
        if org is None or (user.role != UserRole.super_admin and org.institution_id != user.institution_id):
            raise HTTPException(status_code=404, detail="Department not found for this campus")
        if user.role == UserRole.org_admin:
            from app.models.organization_staff import OrganizationStaff
            staff_res = await session.execute(
                select(OrganizationStaff.organization_id).where(
                    OrganizationStaff.user_id == user.id,
                    OrganizationStaff.organization_id == target_uuid,
                ).limit(1)
            )
            is_staff = staff_res.scalar_one_or_none()
            if not is_staff:
                att_res = await session.execute(
                    select(Attendee.organization_id).where(
                        Attendee.user_id == user.id,
                        Attendee.organization_id == target_uuid,
                    ).limit(1)
                )
                is_staff = att_res.scalar_one_or_none()
            if not is_staff:
                raise HTTPException(status_code=403, detail="You are not authorized to create events for this organization.")
        data["organization_id"] = target_uuid
    else:
        # For org_admin, resolve their assigned organization
        if user.role == UserRole.org_admin:
            from app.models.organization_staff import OrganizationStaff
            staff_res = await session.execute(
                select(OrganizationStaff.organization_id).where(OrganizationStaff.user_id == user.id).limit(1)
            )
            assigned_org_id = staff_res.scalar_one_or_none()
            if not assigned_org_id:
                att_res = await session.execute(
                    select(Attendee.organization_id).where(Attendee.user_id == user.id).limit(1)
                )
                assigned_org_id = att_res.scalar_one_or_none()
            if assigned_org_id:
                data["organization_id"] = assigned_org_id
            else:
                raise HTTPException(status_code=400, detail="Please select an organization to host this event.")
        else:
            raise HTTPException(status_code=400, detail="Please select an organization to host this event.")

    if "department_id" in data:
        del data["department_id"]

    event = await event_service.create_event(session, data, user.id)
    return _event_response(event)


@router.get("/upcoming", response_model=UpcomingEventListResponse)
async def list_upcoming_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    organization_id: str | None = Query(None),
    department_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user),
):
    org_filter = organization_id or department_id
    inst_filter = None
    if current_user:
        if current_user.role == UserRole.super_admin:
            inst_filter = None
        else:
            inst_filter = str(current_user.institution_id) if current_user.institution_id else None

    if current_user and current_user.role != UserRole.admin and current_user.role != UserRole.super_admin:
        attendee_res = await session.execute(
            select(Attendee).options(selectinload(Attendee.organization)).where(Attendee.user_id == current_user.id)
        )
        att = attendee_res.scalar_one_or_none()
        if att:
            if not org_filter and att.organization_id:
                org_filter = str(att.organization_id)
            if not inst_filter and att.organization and att.organization.institution_id:
                inst_filter = str(att.organization.institution_id)

    skip = (page - 1) * size
    events_with_counts = await event_service.get_upcoming_events(
        session, skip=skip, limit=size, organization_id=org_filter, institution_id=inst_filter
    )
    total = await event_service.count_upcoming_events(
        session, organization_id=org_filter, institution_id=inst_filter
    )
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
            target_scope=event.target_scope.value if hasattr(event.target_scope, "value") else str(event.target_scope or "department_only"),
            co_host_dept_ids=event.co_host_dept_ids,
        )
        for event, sessions_count, active_sessions_count in events_with_counts
    ]
    return UpcomingEventListResponse(items=items, total=total, page=page, size=size)


@router.get("/all", response_model=UpcomingEventListResponse)
async def list_all_events(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    organization_id: str | None = Query(None),
    department_id: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_current_user),
):
    org_filter = organization_id or department_id
    inst_filter = None
    if current_user:
        if current_user.role == UserRole.super_admin:
            inst_filter = None
        else:
            inst_filter = str(current_user.institution_id) if current_user.institution_id else None

    if current_user and current_user.role != UserRole.admin and current_user.role != UserRole.super_admin:
        attendee_res = await session.execute(
            select(Attendee).options(selectinload(Attendee.organization)).where(Attendee.user_id == current_user.id)
        )
        att = attendee_res.scalar_one_or_none()
        if att:
            if not org_filter and att.organization_id:
                org_filter = str(att.organization_id)
            if not inst_filter and att.organization and att.organization.institution_id:
                inst_filter = str(att.organization.institution_id)

    skip = (page - 1) * size
    events_with_counts = await event_service.get_all_events(
        session, skip=skip, limit=size, organization_id=org_filter, institution_id=inst_filter
    )
    total = await event_service.count_all_events(
        session, organization_id=org_filter, institution_id=inst_filter
    )
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
            target_scope=event.target_scope.value if hasattr(event.target_scope, "value") else str(event.target_scope or "department_only"),
            co_host_dept_ids=event.co_host_dept_ids,
        )
        for event, sessions_count, active_sessions_count in events_with_counts
    ]
    return UpcomingEventListResponse(items=items, total=total, page=page, size=size)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    event = await event_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if current_user.role != UserRole.super_admin and current_user.institution_id:
        if event.institution_id != current_user.institution_id:
            raise HTTPException(status_code=404, detail="Event not found")
    return _event_response(event)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: uuid.UUID,
    body: EventUpdate,
    session: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    event = await event_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.organization_id:
        scope.assert_can_manage_org(event.organization_id)

    data = body.model_dump(exclude_unset=True)
    target_org_id = data.get("organization_id") or data.get("department_id")
    if target_org_id:
        scope.assert_can_manage_org(target_org_id)
        data["organization_id"] = uuid.UUID(target_org_id)
    if "department_id" in data:
        del data["department_id"]

    updated = await event_service.update_event(session, event_id, data)
    await session.commit()
    return _event_response(updated)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    event = await event_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.organization_id:
        scope.assert_can_manage_org(event.organization_id)

    ok = await event_service.delete_event(session, event_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Event not found")
    await session.commit()
    return None


@router.post("/{event_id}/photo")
async def upload_event_photo(
    event_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    event = await event_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.organization_id:
        scope.assert_can_manage_org(event.organization_id)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    import base64
    base64_data = base64.b64encode(content).decode("utf-8")
    mime_type = file.content_type or "image/jpeg"
    ext = (file.filename or "").lower()
    if "png" in ext:
        mime_type = "image/png"
    elif "webp" in ext:
        mime_type = "image/webp"

    event.photo_url = f"data:{mime_type};base64,{base64_data}"
    await session.commit()
    await session.refresh(event)
    return {"success": True, "photo_url": event.photo_url}


@router.delete("/{event_id}/photo")
async def delete_event_photo(
    event_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    event = await event_service.get_event(session, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.organization_id:
        scope.assert_can_manage_org(event.organization_id)

    event.photo_url = None
    await session.commit()
    return {"success": True}
