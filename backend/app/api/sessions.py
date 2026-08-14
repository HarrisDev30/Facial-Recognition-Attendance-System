import uuid

from app.database import get_session
from app.middleware.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.attendance import (
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
from app.services.event_service import (
    activate_session as service_activate_session,
)
from app.services.event_service import (
    create_session as service_create_session,
)
from app.services.event_service import (
    deactivate_session as service_deactivate_session,
)
from app.services.event_service import (
    get_event,
    get_sessions,
)
from app.services.event_service import (
    get_session as service_get_session,
)
from app.services.event_service import (
    update_session as service_update_session,
)
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["sessions"])


@router.get(
    "/api/events/{event_id}/sessions",
    response_model=list[SessionResponse],
)
async def list_sessions(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    items = await get_sessions(db, event_id)
    return [
        SessionResponse(
            id=str(s.id),
            event_id=str(s.event_id),
            name=s.name,
            start_time=s.start_time,
            end_time=s.end_time,
            status=s.status.value,
            confidence_threshold=s.confidence_threshold,
            detection_zone=s.detection_zone,
            activated_at=s.activated_at,
            deactivated_at=s.deactivated_at,
            created_at=s.created_at,
        )
        for s in items
    ]


@router.post(
    "/api/events/{event_id}/sessions",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    event_id: uuid.UUID,
    body: SessionCreate,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    event = await get_event(db, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    att_session = await service_create_session(db, event_id, body.model_dump())
    return SessionResponse(
        id=str(att_session.id),
        event_id=str(att_session.event_id),
        name=att_session.name,
        start_time=att_session.start_time,
        end_time=att_session.end_time,
        status=att_session.status.value,
        confidence_threshold=att_session.confidence_threshold,
        detection_zone=att_session.detection_zone,
        activated_at=att_session.activated_at,
        deactivated_at=att_session.deactivated_at,
        created_at=att_session.created_at,
    )


@router.get("/api/sessions/{session_id}", response_model=SessionResponse)
async def get_session_route(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    att_session = await service_get_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        id=str(att_session.id),
        event_id=str(att_session.event_id),
        name=att_session.name,
        start_time=att_session.start_time,
        end_time=att_session.end_time,
        status=att_session.status.value,
        confidence_threshold=att_session.confidence_threshold,
        detection_zone=att_session.detection_zone,
        activated_at=att_session.activated_at,
        deactivated_at=att_session.deactivated_at,
        created_at=att_session.created_at,
    )


@router.put("/api/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: uuid.UUID,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    att_session = await service_update_session(db, session_id, data)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        id=str(att_session.id),
        event_id=str(att_session.event_id),
        name=att_session.name,
        start_time=att_session.start_time,
        end_time=att_session.end_time,
        status=att_session.status.value,
        confidence_threshold=att_session.confidence_threshold,
        detection_zone=att_session.detection_zone,
        activated_at=att_session.activated_at,
        deactivated_at=att_session.deactivated_at,
        created_at=att_session.created_at,
    )


@router.patch(
    "/api/sessions/{session_id}/activate",
    response_model=SessionResponse,
)
async def activate_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    att_session = await service_activate_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        id=str(att_session.id),
        event_id=str(att_session.event_id),
        name=att_session.name,
        start_time=att_session.start_time,
        end_time=att_session.end_time,
        status=att_session.status.value,
        confidence_threshold=att_session.confidence_threshold,
        detection_zone=att_session.detection_zone,
        activated_at=att_session.activated_at,
        deactivated_at=att_session.deactivated_at,
        created_at=att_session.created_at,
    )


@router.patch(
    "/api/sessions/{session_id}/deactivate",
    response_model=SessionResponse,
)
async def deactivate_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    att_session = await service_deactivate_session(db, session_id)
    if att_session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse(
        id=str(att_session.id),
        event_id=str(att_session.event_id),
        name=att_session.name,
        start_time=att_session.start_time,
        end_time=att_session.end_time,
        status=att_session.status.value,
        confidence_threshold=att_session.confidence_threshold,
        detection_zone=att_session.detection_zone,
        activated_at=att_session.activated_at,
        deactivated_at=att_session.deactivated_at,
        created_at=att_session.created_at,
    )
