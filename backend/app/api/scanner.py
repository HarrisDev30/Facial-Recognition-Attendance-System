import uuid

from app.config import settings
from app.database import get_session
from app.middleware.auth import (
    DomainScope,
    get_domain_scope,
    require_admin_or_marshal,
)
from app.models.user import User
from app.schemas.scanner import (
    FrameProcessResponse,
    LiveStatsResponse,
    ManualOverrideRequest,
    ManualOverrideResponse,
    QRCheckInRequest,
    QRCheckInResponse,
)
from app.services import scanner_service
from app.services.websocket_manager import (
    connect_to_session,
    disconnect_from_session,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, WebSocket
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/scanner", tags=["scanner"])


@router.post("/frame", response_model=FrameProcessResponse)
async def process_frame(
    session_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    try:
        sess_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    # Enforce departmental & tenant operational permissions
    await scope.assert_can_operate_session(sess_uuid, db)

    image_bytes = await file.read()
    if not image_bytes:
        return FrameProcessResponse(face_count=0, identified=False)

    if len(image_bytes) > settings.max_image_size_bytes:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB)")

    result = await scanner_service.process_frame(db, sess_uuid, image_bytes)
    return FrameProcessResponse(**result)


@router.websocket("/{session_id}/stream")
async def scanner_stream(
    websocket: WebSocket,
    session_id: str,
    token: str | None = None,
):
    if not token:
        await websocket.close(code=4001)
        return
    from app.services.auth_service import decode_token
    payload = decode_token(token)
    if payload is None:
        await websocket.close(code=4001)
        return
    role = payload.get("role")
    if role not in ("admin", "marshal", "org_admin", "super_admin"):
        await websocket.close(code=4003)
        return
    await connect_to_session(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        pass
    finally:
        disconnect_from_session(session_id, websocket)


@router.post("/qr-checkin", response_model=QRCheckInResponse)
async def qr_checkin(
    body: QRCheckInRequest,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    try:
        sess_uuid = uuid.UUID(body.session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    await scope.assert_can_operate_session(sess_uuid, db)

    result = await scanner_service.qr_checkin(db, sess_uuid, body.attendee_id)
    return QRCheckInResponse(**result)


@router.post("/manual-override", response_model=ManualOverrideResponse)
async def manual_override(
    body: ManualOverrideRequest,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    try:
        sess_uuid = uuid.UUID(body.session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    await scope.assert_can_operate_session(sess_uuid, db)

    result = await scanner_service.manual_override(
        db, sess_uuid, body.attendee_id, scope.user.id, body.reason
    )
    return ManualOverrideResponse(**result)


@router.get("/{session_id}/live-stats", response_model=LiveStatsResponse)
async def live_stats(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    try:
        sess_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    await scope.assert_can_operate_session(sess_uuid, db)

    result = await scanner_service.get_live_stats(db, sess_uuid)
    return LiveStatsResponse(**result)
