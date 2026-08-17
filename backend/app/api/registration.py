import uuid

from app.config import settings
from app.database import get_session
from app.middleware.auth import require_admin
from app.models.user import User
from app.schemas.attendee import ConsentRequest
from app.schemas.registration import EmbeddingUploadResponse
from app.services import attendee_service, face_recognition, registration_service
from app.services.faiss_index import force_rebuild
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/registration", tags=["registration"])


@router.post("/preview")
async def preview_frame(
    file: UploadFile = File(...),
):
    image_bytes = await file.read()
    if len(image_bytes) > settings.max_image_size_bytes:
        return {
            "face_detected": False,
            "face_count": 0,
            "faces": [],
            "quality_pass": False,
            "hint": "Image too large — maximum 5 MB",
        }
    if not image_bytes:
        return {
            "face_detected": False,
            "face_count": 0,
            "faces": [],
            "quality_pass": False,
            "hint": "Empty image",
        }

    faces = await face_recognition.detect_faces(image_bytes)

    if not faces:
        return {
            "face_detected": False,
            "face_count": 0,
            "faces": [],
            "quality_pass": False,
            "hint": "No face detected — center your face in the frame",
        }

    if len(faces) > 1:
        return {
            "face_detected": True,
            "face_count": len(faces),
            "faces": faces,
            "quality_pass": False,
            "hint": f"{len(faces)} faces detected — ensure only you is in frame",
        }

    face = faces[0]
    area_ratio = (
        face["face_width"] * face["face_height"]
    ) / (face["img_width"] * face["img_height"])

    if area_ratio < 0.08:
        return {
            "face_detected": True,
            "face_count": 1,
            "faces": faces,
            "quality_pass": False,
            "hint": "Face too small — move closer to the camera",
        }

    yaw = abs(face["pose"][1])
    if yaw > 45:
        return {
            "face_detected": True,
            "face_count": 1,
            "faces": faces,
            "quality_pass": False,
            "hint": "Turn your face toward the camera",
        }

    return {
        "face_detected": True,
        "face_count": 1,
        "faces": faces,
        "quality_pass": True,
        "hint": "Perfect! Hold still...",
    }


from app.middleware.auth import get_current_user


@router.post("/consent/{attendee_id}")
async def set_consent(
    attendee_id: uuid.UUID,
    body: ConsentRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await registration_service.update_consent(session, attendee_id, body.consent_given)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee not found")
    return {
        "id": str(attendee.id),
        "identifier": attendee.identifier,
        "consent_given": attendee.consent_given,
        "consent_given_at": attendee.consent_given_at.isoformat()
        if attendee.consent_given_at
        else None,
    }


@router.post("/embeddings/{attendee_id}", response_model=EmbeddingUploadResponse)
async def upload_embedding(
    attendee_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_angle: str | None = Form(None),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee = await attendee_service.get_attendee(session, attendee_id)
    if attendee is None:
        raise HTTPException(status_code=404, detail="Attendee not found")

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

    embedding_bytes, det_score, face_info = face_data[0]

    if det_score < 0.5:
        raise HTTPException(
            status_code=400,
            detail=f"Face detection score too low ({det_score:.3f})",
        )

    area_ratio = (face_info["face_width"] * face_info["face_height"]) / (
        face_info["img_width"] * face_info["img_height"]
    )
    if area_ratio < 0.08:
        raise HTTPException(
            status_code=400,
            detail="Face too small — move closer to the camera",
        )

    pose = face_info.get("pose", [0, 0, 0])
    yaw = abs(pose[1]) if len(pose) > 1 else 0
    if yaw > 45:
        raise HTTPException(
            status_code=400,
            detail="Turn your face toward the camera",
        )

    emb = await registration_service.save_embedding(
        session=session,
        attendee_id=attendee_id,
        embedding_bytes=embedding_bytes,
        camera_angle=camera_angle,
    )

    background_tasks.add_task(force_rebuild)

    return EmbeddingUploadResponse(
        attendee_id=str(attendee_id),
        embedding_id=str(emb.id),
        camera_angle=camera_angle,
        message=f"Face embedding saved (detection score: {det_score:.3f})",
    )


@router.get("/embeddings/{attendee_id}")
async def list_embeddings(
    attendee_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    embeddings = await registration_service.get_embeddings(session, attendee_id)
    return [
        {
            "id": str(e.id),
            "camera_angle": e.camera_angle,
            "created_at": e.created_at.isoformat(),
        }
        for e in embeddings
    ]
