import random
import uuid
from datetime import UTC, datetime, timedelta

from app.database import get_session
from app.middleware.auth import get_current_user, require_admin
from app.models.institution import Institution
from app.models.scanner_device import ScannerDevice, ScannerPairingCode
from app.models.user import User, UserRole
from app.schemas.device import (
    DetectionZoneRequest,
    ScannerDeviceCreate,
    ScannerDeviceListItem,
    ScannerDeviceResponse,
)
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["devices"])


class PairingCodeResponse(BaseModel):
    code: str
    expires_at: str
    expires_in_seconds: int


class DevicePairRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)
    name: str = Field(..., min_length=2, max_length=100)
    device_type: str = Field("workstation_laptop", max_length=50)
    location: str | None = Field(None, max_length=200)


class DevicePairResponse(BaseModel):
    device_id: str
    device_token: str
    name: str
    device_type: str
    location: str | None
    institution_id: str
    institution_name: str
    institution_code: str


# 1. Admin generates 6-digit pairing code
@router.post("/api/admin/scanner-devices/generate-pairing-code", response_model=PairingCodeResponse)
async def generate_pairing_code(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    inst_id = current_user.institution_id
    if not inst_id:
        db_user = await db.get(User, current_user.id)
        if db_user and db_user.institution_id:
            inst_id = db_user.institution_id

    if not inst_id:
        inst_res = await db.execute(select(Institution.id).limit(1))
        inst_id = inst_res.scalar_one_or_none()

    if not inst_id:
        raise HTTPException(status_code=400, detail="An active institution is required to generate pairing codes")

    # Generate random 6-digit numeric string (100000 - 999999)
    code_str = f"{random.randint(100000, 999999)}"
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=15)

    pairing_record = ScannerPairingCode(
        institution_id=inst_id,
        created_by=current_user.id,
        code=code_str,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(pairing_record)
    await db.commit()

    return PairingCodeResponse(
        code=code_str,
        expires_at=expires_at.isoformat(),
        expires_in_seconds=900,
    )


# 2. Entrance Kiosk / Mobile scanner pairs with 6-digit code (Headless / Public)
@router.post("/api/devices/pair", response_model=DevicePairResponse, status_code=status.HTTP_201_CREATED)
async def pair_scanner_device(
    body: DevicePairRequest,
    db: AsyncSession = Depends(get_session),
):
    clean_code = body.code.strip()
    now = datetime.now(UTC)

    stmt = (
        select(ScannerPairingCode)
        .where(
            ScannerPairingCode.code == clean_code,
            ScannerPairingCode.is_used.is_(False),
            ScannerPairingCode.expires_at > now,
        )
        .order_by(ScannerPairingCode.created_at.desc())
    )
    result = await db.execute(stmt)
    pairing_code = result.scalar_one_or_none()

    if not pairing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired 6-digit pairing code. Please generate a new code from the Admin portal.",
        )

    # Mark code as used
    pairing_code.is_used = True

    # Retrieve Institution
    inst = await db.get(Institution, pairing_code.institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    # Create paired ScannerDevice
    token = uuid.uuid4()
    device = ScannerDevice(
        institution_id=pairing_code.institution_id,
        name=body.name.strip(),
        device_type=body.device_type,
        location=body.location.strip() if body.location else None,
        device_token=token,
        is_active=True,
        last_activity=now,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)

    return DevicePairResponse(
        device_id=str(device.id),
        device_token=str(token),
        name=device.name,
        device_type=device.device_type,
        location=device.location,
        institution_id=str(inst.id),
        institution_name=inst.name,
        institution_code=inst.code,
    )


# 3. Verify active device token
@router.get("/api/devices/verify-token/{device_token}")
async def verify_device_token(
    device_token: str,
    db: AsyncSession = Depends(get_session),
):
    try:
        tok = uuid.UUID(device_token)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token format")

    stmt = select(ScannerDevice).where(ScannerDevice.device_token == tok, ScannerDevice.is_active.is_(True))
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=401, detail="Device token invalid or revoked")

    inst = await db.get(Institution, device.institution_id)
    return {
        "valid": True,
        "device_id": str(device.id),
        "name": device.name,
        "institution_id": str(device.institution_id),
        "institution_name": inst.name if inst else None,
        "institution_code": inst.code if inst else None,
    }


# Standard Admin Device Endpoints
@router.post("/api/admin/scanner-devices", response_model=ScannerDeviceResponse)
async def register_device(
    body: ScannerDeviceCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    if not current_user.institution_id and current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=400, detail="Admin must be associated with an institution")

    device = ScannerDevice(
        institution_id=current_user.institution_id,
        name=body.name,
        device_type=body.device_type,
        location=body.location,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


@router.get("/api/admin/scanner-devices", response_model=list[ScannerDeviceListItem])
async def list_scanner_devices(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    query = select(ScannerDevice).order_by(ScannerDevice.created_at.desc())
    if current_user.role != UserRole.super_admin:
        inst_id = current_user.institution_id
        if not inst_id:
            db_user = await db.get(User, current_user.id)
            if db_user and db_user.institution_id:
                inst_id = db_user.institution_id

        if not inst_id:
            inst_res = await db.execute(select(Institution.id).limit(1))
            inst_id = inst_res.scalar_one_or_none()
        if inst_id:
            query = query.where(ScannerDevice.institution_id == inst_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/api/admin/scanner-devices/{device_id}", response_model=ScannerDeviceResponse)
async def get_scanner_device(
    device_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    query = select(ScannerDevice).where(ScannerDevice.id == uid)
    if current_user.role != UserRole.super_admin and current_user.institution_id:
        query = query.where(ScannerDevice.institution_id == current_user.institution_id)

    result = await db.execute(query)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@router.post("/api/admin/scanner-devices/{device_id}/detection-zone", response_model=ScannerDeviceResponse)
async def configure_detection_zone(
    device_id: str,
    body: DetectionZoneRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    query = select(ScannerDevice).where(ScannerDevice.id == uid)
    if current_user.role != UserRole.super_admin and current_user.institution_id:
        query = query.where(ScannerDevice.institution_id == current_user.institution_id)

    result = await db.execute(query)
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


@router.put("/api/admin/scanner-devices/{device_id}/heartbeat")
async def device_heartbeat(
    device_id: str,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    result = await db.execute(select(ScannerDevice).where(ScannerDevice.id == uid))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.last_activity = datetime.now(UTC)
    await db.commit()
    return {"success": True}
