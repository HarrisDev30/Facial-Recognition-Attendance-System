import random
import uuid
from datetime import UTC, datetime, timedelta

from app.database import get_session
from app.middleware.auth import get_current_user, get_domain_scope, DomainScope
from app.models.institution import Institution
from app.models.organization import Organization
from app.models.scanner_device import ScannerDevice, ScannerPairingCode
from app.models.user import User, UserRole
from app.schemas.device import (
    DetectionZoneRequest,
    ScannerDeviceCreate,
    ScannerDeviceListItem,
    ScannerDeviceResponse,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["devices"])


class PairingCodeGenerateRequest(BaseModel):
    organization_id: uuid.UUID | None = None


class PairingCodeResponse(BaseModel):
    code: str
    expires_at: str
    expires_in_seconds: int
    organization_id: str | None = None


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
    organization_id: str | None = None
    organization_name: str | None = None
    organization_code: str | None = None


class DeviceReassignRequest(BaseModel):
    organization_id: uuid.UUID | None = None


# 1. Admin generates 6-digit pairing code (Institution Admin or Org Admin)
@router.post("/api/admin/scanner-devices/generate-pairing-code", response_model=PairingCodeResponse)
async def generate_pairing_code(
    body: PairingCodeGenerateRequest | None = None,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to generate pairing codes",
        )

    inst_id = scope.institution_id
    if not inst_id and not scope.is_super_admin:
        inst_res = await db.execute(select(Institution.id).limit(1))
        inst_id = inst_res.scalar_one_or_none()

    if not inst_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active institution is required to generate pairing codes",
        )

    target_org_id: uuid.UUID | None = None
    if scope.is_org_admin:
        if not scope.assigned_org_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No assigned organization found for this organization admin",
            )
        if body and body.organization_id:
            scope.assert_can_manage_org(body.organization_id)
            target_org_id = body.organization_id
        else:
            target_org_id = scope.assigned_org_ids[0]
    elif body and body.organization_id:
        target_org_id = body.organization_id

    # Generate random 6-digit numeric string (100000 - 999999)
    code_str = f"{random.randint(100000, 999999)}"
    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=15)

    pairing_record = ScannerPairingCode(
        institution_id=inst_id,
        organization_id=target_org_id,
        created_by=scope.user.id,
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
        organization_id=str(target_org_id) if target_org_id else None,
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

    org = None
    if pairing_code.organization_id:
        org = await db.get(Organization, pairing_code.organization_id)

    # Create paired ScannerDevice
    token = uuid.uuid4()
    device = ScannerDevice(
        institution_id=pairing_code.institution_id,
        organization_id=pairing_code.organization_id,
        created_by=pairing_code.created_by,
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
        organization_id=str(org.id) if org else None,
        organization_name=org.name if org else None,
        organization_code=org.code if org else None,
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
    org = await db.get(Organization, device.organization_id) if device.organization_id else None

    return {
        "valid": True,
        "device_id": str(device.id),
        "name": device.name,
        "institution_id": str(device.institution_id),
        "institution_name": inst.name if inst else None,
        "institution_code": inst.code if inst else None,
        "organization_id": str(org.id) if org else None,
        "organization_name": org.name if org else None,
        "organization_code": org.code if org else None,
    }


# 4. Standard Admin Device Management (Scoped via DomainScope)
@router.post("/api/admin/scanner-devices", response_model=ScannerDeviceResponse)
async def register_device(
    body: ScannerDeviceCreate,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    inst_id = scope.institution_id
    if not inst_id and not scope.is_super_admin:
        raise HTTPException(status_code=400, detail="Admin must be associated with an institution")

    target_org: uuid.UUID | None = None
    if scope.is_org_admin:
        if body.organization_id:
            scope.assert_can_manage_org(body.organization_id)
            target_org = body.organization_id
        elif scope.assigned_org_ids:
            target_org = scope.assigned_org_ids[0]
    elif body.organization_id:
        target_org = body.organization_id

    device = ScannerDevice(
        institution_id=inst_id,
        organization_id=target_org,
        created_by=scope.user.id,
        name=body.name,
        device_type=body.device_type,
        location=body.location,
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)

    org_obj = await db.get(Organization, device.organization_id) if device.organization_id else None

    return ScannerDeviceResponse(
        id=device.id,
        name=device.name,
        device_type=device.device_type,
        device_token=str(device.device_token),
        location=device.location,
        last_activity=device.last_activity,
        is_active=device.is_active,
        detection_zone=device.detection_zone,
        face_size_min=device.face_size_min,
        confidence_threshold=device.confidence_threshold,
        organization_id=device.organization_id,
        organization_name=org_obj.name if org_obj else None,
        organization_code=org_obj.code if org_obj else None,
        created_at=device.created_at,
    )


@router.get("/api/admin/scanner-devices", response_model=list[ScannerDeviceListItem])
async def list_scanner_devices(
    organization_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher and not scope.is_marshal:
        raise HTTPException(status_code=403, detail="Device access not permitted")

    query = select(ScannerDevice, Organization).outerjoin(
        Organization, ScannerDevice.organization_id == Organization.id
    ).order_by(ScannerDevice.created_at.desc())

    # Apply unified domain scope
    query = scope.scope_query(query, ScannerDevice)

    if organization_id:
        if scope.is_org_admin:
            scope.assert_can_manage_org(organization_id)
        query = query.where(ScannerDevice.organization_id == organization_id)

    result = await db.execute(query)
    rows = result.all()

    items = []
    for dev, org in rows:
        items.append(
            ScannerDeviceListItem(
                id=dev.id,
                name=dev.name,
                device_type=dev.device_type,
                location=dev.location,
                last_activity=dev.last_activity,
                is_active=dev.is_active,
                organization_id=dev.organization_id,
                organization_name=org.name if org else None,
                organization_code=org.code if org else None,
                created_at=dev.created_at,
            )
        )
    return items


@router.get("/api/admin/scanner-devices/{device_id}", response_model=ScannerDeviceResponse)
async def get_scanner_device(
    device_id: str,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    query = select(ScannerDevice, Organization).outerjoin(
        Organization, ScannerDevice.organization_id == Organization.id
    ).where(ScannerDevice.id == uid)

    query = scope.scope_query(query, ScannerDevice)
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")

    device, org = row
    return ScannerDeviceResponse(
        id=device.id,
        name=device.name,
        device_type=device.device_type,
        device_token=str(device.device_token),
        location=device.location,
        last_activity=device.last_activity,
        is_active=device.is_active,
        detection_zone=device.detection_zone,
        face_size_min=device.face_size_min,
        confidence_threshold=device.confidence_threshold,
        organization_id=device.organization_id,
        organization_name=org.name if org else None,
        organization_code=org.code if org else None,
        created_at=device.created_at,
    )


@router.patch("/api/admin/scanner-devices/{device_id}/reassign", response_model=ScannerDeviceResponse)
async def reassign_scanner_device(
    device_id: str,
    body: DeviceReassignRequest,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_institution_admin and not scope.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Institution Admins or Super Admins can reassign device ownership",
        )

    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    query = select(ScannerDevice).where(ScannerDevice.id == uid)
    if not scope.is_super_admin and scope.institution_id:
        query = query.where(ScannerDevice.institution_id == scope.institution_id)

    result = await db.execute(query)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    device.organization_id = body.organization_id
    await db.commit()
    await db.refresh(device)

    org_obj = await db.get(Organization, device.organization_id) if device.organization_id else None

    return ScannerDeviceResponse(
        id=device.id,
        name=device.name,
        device_type=device.device_type,
        device_token=str(device.device_token),
        location=device.location,
        last_activity=device.last_activity,
        is_active=device.is_active,
        detection_zone=device.detection_zone,
        face_size_min=device.face_size_min,
        confidence_threshold=device.confidence_threshold,
        organization_id=device.organization_id,
        organization_name=org_obj.name if org_obj else None,
        organization_code=org_obj.code if org_obj else None,
        created_at=device.created_at,
    )


@router.post("/api/admin/scanner-devices/{device_id}/detection-zone", response_model=ScannerDeviceResponse)
async def configure_detection_zone(
    device_id: str,
    body: DetectionZoneRequest,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    try:
        uid = uuid.UUID(device_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid device ID")

    query = select(ScannerDevice, Organization).outerjoin(
        Organization, ScannerDevice.organization_id == Organization.id
    ).where(ScannerDevice.id == uid)

    query = scope.scope_query(query, ScannerDevice)
    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Device not found")

    device, org = row

    if body.zone_coordinates is not None:
        device.detection_zone = body.zone_coordinates
    if body.face_size_min is not None:
        device.face_size_min = body.face_size_min
    if body.confidence_threshold is not None:
        device.confidence_threshold = body.confidence_threshold

    await db.commit()
    await db.refresh(device)

    return ScannerDeviceResponse(
        id=device.id,
        name=device.name,
        device_type=device.device_type,
        device_token=str(device.device_token),
        location=device.location,
        last_activity=device.last_activity,
        is_active=device.is_active,
        detection_zone=device.detection_zone,
        face_size_min=device.face_size_min,
        confidence_threshold=device.confidence_threshold,
        organization_id=device.organization_id,
        organization_name=org.name if org else None,
        organization_code=org.code if org else None,
        created_at=device.created_at,
    )


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
