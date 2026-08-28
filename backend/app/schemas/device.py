from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ScannerDeviceCreate(BaseModel):
    name: str
    device_type: str
    location: str | None = None
    organization_id: UUID | None = None


class ScannerDeviceResponse(BaseModel):
    id: UUID
    name: str
    device_type: str
    device_token: str
    location: str | None
    last_activity: datetime | None
    is_active: bool
    detection_zone: dict | None
    face_size_min: int | None
    confidence_threshold: float | None
    organization_id: UUID | None = None
    organization_name: str | None = None
    organization_code: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ScannerDeviceListItem(BaseModel):
    id: UUID
    name: str
    device_type: str
    location: str | None
    last_activity: datetime | None
    is_active: bool
    organization_id: UUID | None = None
    organization_name: str | None = None
    organization_code: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DetectionZoneRequest(BaseModel):
    zone_coordinates: dict | None = None
    face_size_min: int | None = None
    confidence_threshold: float | None = None
