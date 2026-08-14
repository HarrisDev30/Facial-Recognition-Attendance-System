import uuid
from datetime import UTC

from app.database import get_session
from app.middleware.auth import get_current_user, require_admin
from app.models.scanner_device import ScannerDevice
from app.schemas.device import (
    DetectionZoneRequest,
    ScannerDeviceCreate,
    ScannerDeviceListItem,
    ScannerDeviceResponse,
)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/admin/scanner-devices", tags=["devices"])


@router.post("", response_model=ScannerDeviceResponse)
async def register_device(
    body: ScannerDeviceCreate,
    db: AsyncSession = Depends(get_session),
    _=Depends(require_admin),
):
    device = ScannerDevice(
        name=body.name,
        device_type=body.device_type,
        location=body.location,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("", response_model=list[ScannerDeviceListItem])
async def list_scanner_devices(
    db: AsyncSession = Depends(get_session),
    _=Depends(require_admin),
):
    result = await db.execute(
        select(ScannerDevice).order_by(ScannerDevice.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{device_id}", response_model=ScannerDeviceResponse)
async def get_scanner_device(
    device_id: str,
    db: AsyncSession = Depends(get_session),
    _=Depends(require_admin),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    result = await db.execute(select(ScannerDevice).where(ScannerDevice.id == uid))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.post("/{device_id}/detection-zone", response_model=ScannerDeviceResponse)
async def configure_detection_zone(
    device_id: str,
    body: DetectionZoneRequest,
    db: AsyncSession = Depends(get_session),
    _=Depends(require_admin),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    result = await db.execute(select(ScannerDevice).where(ScannerDevice.id == uid))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    if body.zone_coordinates is not None:
        device.detection_zone = body.zone_coordinates
    if body.face_size_min is not None:
        device.face_size_min = body.face_size_min
    if body.confidence_threshold is not None:
        device.confidence_threshold = body.confidence_threshold

    await db.commit()
    await db.refresh(device)
    return device


@router.put("/{device_id}/heartbeat")
async def device_heartbeat(
    device_id: str,
    db: AsyncSession = Depends(get_session),
    _=Depends(get_current_user),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    result = await db.execute(select(ScannerDevice).where(ScannerDevice.id == uid))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    from datetime import datetime

    device.last_activity = datetime.now(UTC)
    await db.commit()
    return {"success": True}
