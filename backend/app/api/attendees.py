import os
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.config import settings
from app.database import get_session
from app.middleware.auth import get_current_user, require_admin, require_admin_or_marshal
from app.models.attendee import Attendee, AttendeeType
from app.models.consent import Consent
from app.models.data_removal_request import DataRemovalRequest
from app.models.organization import Organization
from app.models.user import User
from app.schemas.attendee import (
    AttendeeProfileResponse,
    AttendeeProfileUpdate,
    ConsentRequest,
    ConsentResponse,
    ConsentStatusResponse,
    DataRemovalRequestBody,
    DataRemovalRequestResponse,
)
from app.schemas.registration import (
    AttendeeCreate,
    AttendeeResponse,
    EmbeddingDeleteResult,
    EmbeddingUploadResult,
    RegistrationResetResult,
    RegistrationStatusResponse,
)
from app.services import attendee_service, face_recognition, registration_service
from app.services.faiss_index import force_rebuild
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/attendees", tags=["attendees"])


@router.get("/me/profile", response_model=AttendeeProfileResponse)
async def get_my_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    num_emb = await registration_service.count_embeddings(session, attendee.id)
    org = await session.get(Organization, attendee.organization_id)

    att_type_val = attendee.attendee_type.value if hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type)

    return AttendeeProfileResponse(
        id=str(attendee.id),
        email=current_user.email,
        first_name=attendee.first_name,
        last_name=attendee.last_name,
        identifier=attendee.identifier,
        attendee_type=att_type_val,
        organization_id=str(attendee.organization_id),
        department_id=str(attendee.organization_id),
        department_code=org.code if org else None,
        department_name=org.name if org else None,
        created_at=attendee.created_at,
        registration_status="registered" if num_emb > 0 else "not_registered",
        num_embeddings=num_emb,
        consent_given=attendee.consent_given,
        profile_photo_url=attendee.profile_photo_url,
    )


@router.put("/me/profile", response_model=AttendeeProfileResponse)
async def update_my_profile(
    body: AttendeeProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if "department_id" in data:
        data["organization_id"] = uuid.UUID(data.pop("department_id"))
    if "organization_id" in data and isinstance(data["organization_id"], str):
        data["organization_id"] = uuid.UUID(data["organization_id"])

    if data:
        attendee = await attendee_service.update_attendee(session, attendee.id, data)

    num_emb = await registration_service.count_embeddings(session, attendee.id)
    org = await session.get(Organization, attendee.organization_id)

    att_type_val = attendee.attendee_type.value if hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type)

    return AttendeeProfileResponse(
        id=str(attendee.id),
        email=current_user.email,
        first_name=attendee.first_name,
        last_name=attendee.last_name,
        identifier=attendee.identifier,
        attendee_type=att_type_val,
        organization_id=str(attendee.organization_id),
        department_id=str(attendee.organization_id),
        department_code=org.code if org else None,
        department_name=org.name if org else None,
        created_at=attendee.created_at,
        registration_status="registered" if num_emb > 0 else "not_registered",
        num_embeddings=num_emb,
        consent_given=attendee.consent_given,
        profile_photo_url=attendee.profile_photo_url,
    )


@router.get("/me/consent", response_model=ConsentStatusResponse)
async def get_my_consent(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")
    return ConsentStatusResponse(
        has_consented=attendee.consent_given,
        consent_date=attendee.consent_given_at,
        consent_version="1.0" if attendee.consent_given else None,
    )


@router.post("/me/consent", response_model=ConsentResponse)
async def update_my_consent(
    body: ConsentRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    updated = await registration_service.update_consent(
        session, attendee.id, body.consent_given
    )
    if updated is None:
        raise HTTPException(status_code=500, detail="Failed to update consent")

    result = await session.execute(
        select(Consent).where(Consent.attendee_id == attendee.id).order_by(Consent.created_at.desc())
    )
    c = result.scalars().first()
    return ConsentResponse(
        success=True,
        consent_id=str(c.id) if c else str(uuid.uuid4()),
        consent_date=updated.consent_given_at or datetime.now(UTC),
    )


@router.post("/me/data-removal", response_model=DataRemovalRequestResponse)
async def request_data_removal(
    body: DataRemovalRequestBody,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    req = DataRemovalRequest(
        user_id=current_user.id,
        attendee_id=attendee.id,
        reason=body.reason,
    )
    session.add(req)
    await session.commit()
    await session.refresh(req)
    return DataRemovalRequestResponse(success=True, request_id=str(req.id))


@router.post("/me/profile-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    content = await file.read()
    if len(content) > settings.profile_photo_max_size:
        raise HTTPException(
            status_code=400,
            detail=f"File size exceeds maximum {settings.profile_photo_max_size // (1024*1024)} MB",
        )

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid image format (JPG, PNG, WebP allowed)")

    os.makedirs(settings.profile_photo_dir, exist_ok=True)
    filename = f"{attendee.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = Path(settings.profile_photo_dir) / filename
    with open(filepath, "wb") as f:
        f.write(content)

    url = f"/api/attendees/{attendee.id}/profile-photo"
    attendee.profile_photo_url = f"/api/attendees/photos/{filename}"
    await session.commit()
    await session.refresh(attendee)
    return {"success": True, "profile_photo_url": attendee.profile_photo_url}


@router.get("/me/registration/status", response_model=RegistrationStatusResponse)
async def get_my_registration_status(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    num_emb = await registration_service.count_embeddings(session, attendee.id)
    embeddings = await registration_service.get_embeddings(session, attendee.id)
    last_reg = embeddings[0].created_at.isoformat() if embeddings else None

    return RegistrationStatusResponse(
        is_registered=num_emb >= 6,
        num_embeddings=num_emb,
        can_register=num_emb < 6,
        last_registration=last_reg,
    )


@router.post("/me/embeddings", response_model=EmbeddingUploadResult)
async def upload_my_embedding(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    image_angle: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    image_bytes = await file.read()
    if len(image_bytes) > settings.max_image_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large — maximum {settings.max_image_size_bytes // (1024*1024)} MB",
        )
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    face_data = await face_recognition.extract_embeddings(image_bytes)
    if not face_data:
        raise HTTPException(
            status_code=400,
            detail="No face detected in the uploaded image",
        )

    if len(face_data) > 1:
        raise HTTPException(
            status_code=400,
            detail="Multiple faces detected — ensure only one face is in frame",
        )

    embedding_bytes, det_score, _ = face_data[0]

    emb = await registration_service.save_embedding(
        session=session,
        attendee_id=attendee.id,
        embedding_bytes=embedding_bytes,
        camera_angle=image_angle,
    )

    background_tasks.add_task(force_rebuild)
    num_emb = await registration_service.count_embeddings(session, attendee.id)

    return EmbeddingUploadResult(
        success=True,
        embedding_id=str(emb.id),
        num_embeddings=num_emb,
        message=f"Face embedding saved for {image_angle or 'frontal'}",
    )


@router.delete("/me/embeddings/{embedding_id}", response_model=EmbeddingDeleteResult)
async def delete_my_embedding(
    embedding_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    ok = await registration_service.delete_embedding(session, embedding_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Embedding not found")

    background_tasks.add_task(force_rebuild)
    num_emb = await registration_service.count_embeddings(session, attendee.id)
    return EmbeddingDeleteResult(success=True, remaining_embeddings=num_emb)


@router.post("/me/registration/reset", response_model=RegistrationResetResult)
async def reset_my_registration(
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await _get_attendee_for_user(session, current_user)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee profile not found")

    await registration_service.reset_registration(session, attendee.id)
    background_tasks.add_task(force_rebuild)
    return RegistrationResetResult(success=True, status="reset_complete")


@router.get("/{attendee_id}/profile-photo")
async def get_profile_photo(
    attendee_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    attendee = await session.get(Attendee, attendee_id)
    if attendee is None or not attendee.profile_photo_url:
        raise HTTPException(status_code=404, detail="Photo not found")

    dir_path = Path(settings.profile_photo_dir)
    pattern = f"{attendee.id}_*"
    matches = list(dir_path.glob(pattern))
    if not matches:
        raise HTTPException(status_code=404, detail="Photo file not found")

    photo_path = matches[0]
    return FileResponse(photo_path)


@router.get("", response_model=list[AttendeeResponse])
async def list_attendees(
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    result = await session.execute(select(Attendee).order_by(Attendee.last_name, Attendee.first_name))
    attendees = result.scalars().all()
    res = []
    for a in attendees:
        org = await session.get(Organization, a.organization_id)
        att_type_val = a.attendee_type.value if hasattr(a.attendee_type, "value") else str(a.attendee_type)
        res.append(
            AttendeeResponse(
                id=str(a.id),
                identifier=a.identifier,
                first_name=a.first_name,
                last_name=a.last_name,
                email=a.email,
                attendee_type=att_type_val,
                department_id=str(a.organization_id),
                department_name=org.name if org else None,
                department_code=org.code if org else None,
                consent_given=a.consent_given,
                consent_given_at=a.consent_given_at,
                created_at=a.created_at,
            )
        )
    return res


@router.post("", response_model=AttendeeResponse, status_code=status.HTTP_201_CREATED)
async def create_attendee(
    body: AttendeeCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    existing = await attendee_service.get_attendee_by_identifier(session, body.identifier)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Attendee with identifier '{body.identifier}' already exists",
        )
    if body.email:
        existing_email = await session.execute(
            select(Attendee).where(Attendee.email == body.email)
        )
        if existing_email.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Attendee with email '{body.email}' already exists",
            )
    dept_id = uuid.UUID(body.department_id)
    org = await session.get(Organization, dept_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")

    data = body.model_dump()
    data["organization_id"] = dept_id
    if "department_id" in data:
        del data["department_id"]
    data["attendee_type"] = AttendeeType(body.attendee_type)
    attendee = await attendee_service.create_attendee(session, data)
    att_type_val = attendee.attendee_type.value if hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type)
    return AttendeeResponse(
        id=str(attendee.id),
        identifier=attendee.identifier,
        first_name=attendee.first_name,
        last_name=attendee.last_name,
        email=attendee.email,
        attendee_type=att_type_val,
        department_id=str(attendee.organization_id),
        department_name=org.name if org else None,
        department_code=org.code if org else None,
        consent_given=attendee.consent_given,
        consent_given_at=attendee.consent_given_at,
        created_at=attendee.created_at,
    )


@router.get("/{attendee_id}", response_model=AttendeeResponse)
async def get_attendee(
    attendee_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(get_current_user),
):
    attendee = await attendee_service.get_attendee(session, attendee_id)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee not found")
    org = await session.get(Organization, attendee.organization_id)
    att_type_val = attendee.attendee_type.value if hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type)
    return AttendeeResponse(
        id=str(attendee.id),
        identifier=attendee.identifier,
        first_name=attendee.first_name,
        last_name=attendee.last_name,
        email=attendee.email,
        attendee_type=att_type_val,
        department_id=str(attendee.organization_id),
        department_name=org.name if org else None,
        department_code=org.code if org else None,
        consent_given=attendee.consent_given,
        consent_given_at=attendee.consent_given_at,
        created_at=attendee.created_at,
    )


@router.put("/{attendee_id}", response_model=AttendeeResponse)
async def update_attendee(
    attendee_id: uuid.UUID,
    body: AttendeeCreate,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    data = body.model_dump()
    if "department_id" in data and data["department_id"]:
        data["organization_id"] = uuid.UUID(data.pop("department_id"))
    data["attendee_type"] = AttendeeType(body.attendee_type)
    attendee = await attendee_service.update_attendee(session, attendee_id, data)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee not found")
    org = await session.get(Organization, attendee.organization_id)
    att_type_val = attendee.attendee_type.value if hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type)
    return AttendeeResponse(
        id=str(attendee.id),
        identifier=attendee.identifier,
        first_name=attendee.first_name,
        last_name=attendee.last_name,
        email=attendee.email,
        attendee_type=att_type_val,
        department_id=str(attendee.organization_id),
        department_name=org.name if org else None,
        department_code=org.code if org else None,
        consent_given=attendee.consent_given,
        consent_given_at=attendee.consent_given_at,
        created_at=attendee.created_at,
    )


@router.delete("/{attendee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendee(
    attendee_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    ok = await attendee_service.delete_attendee(session, attendee_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Attendee not found")
    return None


async def _get_attendee_for_user(session: AsyncSession, user: User) -> Attendee | None:
    result = await session.execute(
        select(Attendee).where(Attendee.user_id == user.id)
    )
    attendee = result.scalar_one_or_none()
    if attendee is not None:
        return attendee

    # Auto-create an Attendee profile for this user if missing
    org_res = await session.execute(select(Organization).limit(1))
    org = org_res.scalar_one_or_none()
    if not org:
        return None

    new_attendee = Attendee(
        user_id=user.id,
        organization_id=org.id,
        identifier=user.email.split("@")[0],
        first_name=user.first_name or "User",
        last_name=user.last_name or "Account",
        email=user.email,
        attendee_type=AttendeeType.student,
        consent_given=True,
    )
    session.add(new_attendee)
    await session.commit()
    await session.refresh(new_attendee)
    return new_attendee
