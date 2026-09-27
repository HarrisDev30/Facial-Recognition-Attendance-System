import uuid

from app.database import get_session
from app.middleware.auth import (
    DomainScope,
    get_current_user,
    get_domain_scope,
    require_admin,
    require_admin_or_marshal,
)
from app.models.user import User, UserRole
from app.schemas.attendance import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
from app.services.event_service import (
    activate_session as service_activate_session,
    create_session as service_create_session,
    deactivate_session as service_deactivate_session,
    extend_session as service_extend_session,
    get_event,
    get_session as service_get_session,
    get_sessions,
    update_session as service_update_session,
)
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["sessions"])


class SessionExtendRequest(BaseModel):
    minutes: int = Field(15, ge=1, le=240)


def _session_response(s) -> SessionResponse:
    status_val = s.status.value if hasattr(s.status, "value") else str(s.status)
    return SessionResponse(
        id=str(s.id),
        event_id=str(s.event_id),
        name=s.name,
        start_time=s.start_time,
        end_time=s.end_time,
        status=status_val,
        confidence_threshold=s.confidence_threshold,
        detection_zone=s.detection_zone,
        activated_at=s.activated_at,
        deactivated_at=s.deactivated_at,
        created_at=s.created_at,
    )


@router.get(
    "/api/events/{event_id}/sessions",
    response_model=list[SessionResponse],
)
async def list_sessions(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    event = await get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Event not found")

    items = await get_sessions(db, event_id)
    return [_session_response(s) for s in items]


@router.post(
    "/api/events/{event_id}/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    event_id: uuid.UUID,
    body: SessionCreate,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    event = await get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.organization_id:
        scope.assert_can_manage_org(event.organization_id)

    att_session = await service_create_session(db, event_id, body.model_dump())
    await db.commit()
    return _session_response(att_session)


@router.get("/api/sessions/{session_id}", response_model=SessionResponse)
async def get_session_route(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    att_session = await service_get_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    event = await get_event(db, att_session.event_id)
    if event and not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id:
        raise HTTPException(status_code=404, detail="Session not found")

    return _session_response(att_session)


@router.put("/api/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    att_session = await service_get_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    event = await get_event(db, att_session.event_id)
    if event is None or (not scope.is_super_admin and scope.institution_id and event.institution_id != scope.institution_id):
        raise HTTPException(status_code=404, detail="Session not found")
    if event.organization_id:
        scope.assert_can_manage_org(event.organization_id)

    data = {k: v for k, v in body.model_dump().items() if v is not None}
    updated = await service_update_session(db, session_id, data)
    await db.commit()
    return _session_response(updated)


@router.patch(
    "/api/sessions/{session_id}/activate",
    response_model=SessionResponse,
)
async def activate_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    # Enforces marshal or admin check with department/co-host authorization
    await scope.assert_can_operate_session(session_id, db)
    att_session = await service_activate_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.commit()
    return _session_response(att_session)


@router.patch(
    "/api/sessions/{session_id}/deactivate",
    response_model=SessionResponse,
)
async def deactivate_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    await scope.assert_can_operate_session(session_id, db)
    att_session = await service_deactivate_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.commit()
    return _session_response(att_session)


@router.post(
    "/api/sessions/{session_id}/extend",
    response_model=SessionResponse,
)
async def extend_session_endpoint(
    session_id: uuid.UUID,
    body: SessionExtendRequest = SessionExtendRequest(minutes=15),
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    await scope.assert_can_operate_session(session_id, db)
    att_session = await service_extend_session(db, session_id, body.minutes)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.commit()
    return _session_response(att_session)

