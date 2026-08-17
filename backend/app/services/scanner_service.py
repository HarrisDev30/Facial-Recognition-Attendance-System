import time
import uuid
from collections import defaultdict

from app.config import settings
from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.attendee import Attendee
from app.models.event import Event
from app.models.membership import Membership
from app.services import face_recognition
from app.services.attendance_service import has_existing_log, log_attendance
from app.services.attendee_service import get_attendee_by_identifier
from app.services.faiss_index import batch_search as faiss_batch_search
from app.services.faiss_index import is_ready as faiss_is_ready
from app.services.websocket_manager import broadcast_to_session
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

_cooldown_cache: dict[str, float] = {}
_checked_in_cache: dict[str, bool] = {}

_face_tracker: dict[str, list[dict]] = defaultdict(list)
_TRACKER_TTL_SECONDS = 2.0
_TRACKER_IOU_THRESHOLD = 0.5


def _bbox_iou(a: list[int], b: list[int]) -> float:
    xa = max(a[0], b[0])
    ya = max(a[1], b[1])
    xb = min(a[2], b[2])
    yb = min(a[3], b[3])
    inter_area = max(0, xb - xa) * max(0, yb - ya)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter_area
    return inter_area / union if union > 0 else 0.0


def _is_good_pose(face_info: dict) -> bool:
    pose = face_info.get("pose", [0, 0, 0])
    yaw = abs(pose[1]) if len(pose) > 1 else 0
    pitch = abs(pose[0]) if len(pose) > 0 else 0
    return yaw <= settings.max_face_yaw and pitch <= settings.max_face_pitch


def _is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError):
        return False


async def is_attendee_member(
    session: AsyncSession,
    attendee_id: uuid.UUID,
    organization_id: uuid.UUID | None,
    event: Event | None = None,
) -> bool:
    if event:
        scope = getattr(event.target_scope, "value", str(event.target_scope or "department_only"))
        if scope == "all":
            return True

        attendee = await session.get(Attendee, attendee_id)
        if not attendee:
            return False

        allowed_ids: set[str] = set()
        if event.organization_id:
            allowed_ids.add(str(event.organization_id))
        if scope == "selected_departments" and event.co_host_dept_ids:
            for item in event.co_host_dept_ids:
                if _is_valid_uuid(item):
                    allowed_ids.add(str(item))

        if str(attendee.organization_id) in allowed_ids:
            return True

        valid_uuids = [uuid.UUID(i) for i in allowed_ids if _is_valid_uuid(i)]
        if valid_uuids:
            res = await session.execute(
                select(Membership).where(
                    Membership.attendee_id == attendee_id,
                    Membership.organization_id.in_(valid_uuids),
                )
            )
            if res.scalar_one_or_none() is not None:
                return True
        return False

    if not organization_id:
        return True

    attendee = await session.get(Attendee, attendee_id)
    if attendee and attendee.organization_id == organization_id:
        return True

    res = await session.execute(
        select(Membership).where(
            Membership.attendee_id == attendee_id,
            Membership.organization_id == organization_id,
        )
    )
    return res.scalar_one_or_none() is not None


async def process_frame(
    session: AsyncSession,
    session_id: uuid.UUID,
    image_bytes: bytes,
) -> dict:
    face_data = await face_recognition.extract_embeddings(
        image_bytes, min_det_score=settings.insightface_min_det_score
    )

    result = {
        "face_count": len(face_data),
        "identified": False,
        "new_checkin_count": 0,
        "identifications": [],
    }

    if not face_data:
        return result

    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None or att_session.status != SessionStatus.active:
        return result

    event = await session.get(Event, att_session.event_id)
    event_org_id = event.organization_id if event else None

    threshold = att_session.confidence_threshold or settings.default_confidence_threshold
    if not faiss_is_ready():
        return result

    session_key = str(session_id)
    now = time.time()
    tracked = _face_tracker[session_key]
    tracked[:] = [t for t in tracked if now - t["last_seen"] < _TRACKER_TTL_SECONDS]

    needs_faiss: list[tuple[int, bytes, float, dict]] = []
    tracked_matches: list[tuple[int, uuid.UUID, float, list[int]]] = []

    for idx, (emb_bytes, det_score, face_info) in enumerate(face_data):
        if not _is_good_pose(face_info):
            result["identifications"].append(
                {
                    "index": idx,
                    "message": "Poor face angle — please face the camera",
                    "bbox": face_info.get("bbox", []),
                }
            )
            continue

        bbox = face_info.get("bbox")
        matched_from_tracker = None
        if bbox:
            for t in tracked:
                if _bbox_iou(bbox, t["bbox"]) >= _TRACKER_IOU_THRESHOLD:
                    matched_from_tracker = t
                    break

        if matched_from_tracker:
            matched_from_tracker["last_seen"] = now
            matched_from_tracker["bbox"] = bbox
            tracked_matches.append(
                (idx, matched_from_tracker["attendee_id"], matched_from_tracker.get("score", 0), bbox)
            )
        else:
            needs_faiss.append((idx, emb_bytes, det_score, face_info))

    if needs_faiss:
        embeddings = [emb for _, emb, _, _ in needs_faiss]
        batch_results = faiss_batch_search(
            embeddings, threshold, min_margin=settings.min_match_margin
        )

        for (orig_idx, emb_bytes, det_score, face_info), (match_score, matched_attendee_id) in zip(
            needs_faiss, batch_results
        ):
            if matched_attendee_id is not None:
                bbox = face_info.get("bbox")
                if bbox:
                    existing = None
                    for t in tracked:
                        if t.get("attendee_id") == matched_attendee_id:
                            existing = t
                            break
                    if existing:
                        existing["last_seen"] = now
                        existing["bbox"] = bbox
                    else:
                        tracked.append(
                            {
                                "bbox": bbox,
                                "attendee_id": matched_attendee_id,
                                "score": match_score,
                                "last_seen": now,
                            }
                        )
                tracked_matches.append((orig_idx, matched_attendee_id, match_score, face_info.get("bbox", [])))
            else:
                result["identifications"].append(
                    {
                        "index": orig_idx,
                        "message": f"No match found (best score: {match_score:.3f})"
                        if match_score and match_score > 0
                        else "No match found",
                        "bbox": face_info.get("bbox", []),
                    }
                )

    for idx, matched_attendee_id, match_score, bbox in tracked_matches:
        cooldown_sec = settings.cooldown_seconds
        cache_key = f"{session_id}:{matched_attendee_id}"
        last_seen = _cooldown_cache.get(cache_key)
        if last_seen and (time.time() - last_seen) < cooldown_sec:
            result["identifications"].append(
                {
                    "index": idx,
                    "attendee_id": str(matched_attendee_id),
                    "message": "On cooldown",
                    "bbox": bbox,
                }
            )
            continue

        attendee = await session.get(Attendee, matched_attendee_id)
        if attendee is None:
            result["identifications"].append(
                {
                    "index": idx,
                    "message": "Attendee record not found",
                    "bbox": bbox,
                }
            )
            continue

        # Check organization membership and event target scope
        is_member = await is_attendee_member(session, matched_attendee_id, event_org_id, event=event)
        if not is_member:
            result["identifications"].append(
                {
                    "index": idx,
                    "attendee_id": str(matched_attendee_id),
                    "attendee_name": f"{attendee.first_name} {attendee.last_name}",
                    "message": "Attendance Denied — Restricted to authorized department students",
                    "bbox": bbox,
                }
            )
            continue

        attendee_name = f"{attendee.first_name} {attendee.last_name}"

        already_cache_key = f"{session_id}:{matched_attendee_id}"
        already = _checked_in_cache.get(already_cache_key)
        if already is None:
            already = await has_existing_log(session, session_id, matched_attendee_id)
            if already:
                _checked_in_cache[already_cache_key] = True

        if already:
            _cooldown_cache[cache_key] = time.time()
            result["identifications"].append(
                {
                    "index": idx,
                    "attendee_id": str(matched_attendee_id),
                    "attendee_name": attendee_name,
                    "confidence_score": match_score,
                    "already_checked_in": True,
                    "message": "Already checked in",
                    "bbox": bbox,
                }
            )
            continue

        att_log = await log_attendance(
            session=session,
            session_id=session_id,
            attendee_id=matched_attendee_id,
            verification_method=VerificationMethod.face_recognition,
            confidence_score=match_score,
        )
        if att_log is None:
            _checked_in_cache[already_cache_key] = True
            _cooldown_cache[cache_key] = time.time()
            result["identifications"].append(
                {
                    "index": idx,
                    "attendee_id": str(matched_attendee_id),
                    "attendee_name": attendee_name,
                    "confidence_score": match_score,
                    "already_checked_in": True,
                    "message": "Already checked in",
                    "bbox": bbox,
                }
            )
            continue
        _checked_in_cache[already_cache_key] = True
        _cooldown_cache[cache_key] = time.time()
        result["identified"] = True
        result["new_checkin_count"] += 1
        result["identifications"].append(
            {
                "index": idx,
                "attendee_id": str(matched_attendee_id),
                "attendee_name": attendee_name,
                "confidence_score": match_score,
                "verification_method": "face_recognition",
                "message": f"Welcome, {attendee_name}!",
                "bbox": bbox,
            }
        )

        await broadcast_to_session(
            str(session_id),
            {
                "event": "attendee_identified",
                "attendee_name": attendee_name,
                "attendee_id": str(matched_attendee_id),
                "confidence_score": match_score,
                "timestamp": att_log.verified_at.isoformat(),
                "verification_method": "face_recognition",
            },
        )

    return result


async def qr_checkin(
    session: AsyncSession,
    session_id: uuid.UUID,
    attendee_id_str: str | None = None,
) -> dict:
    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None:
        return {"success": False, "message": "Session not found"}
    if att_session.status != SessionStatus.active:
        return {"success": False, "message": "Session is not active"}

    event = await session.get(Event, att_session.event_id)
    event_org_id = event.organization_id if event else None

    attendee = None
    if attendee_id_str:
        attendee = await get_attendee_by_identifier(session, attendee_id_str)

    if attendee is None:
        return {"success": False, "message": "Attendee not found"}

    if not await is_attendee_member(session, attendee.id, event_org_id):
        return {"success": False, "message": "Not a member of this organization"}

    att_log = await log_attendance(
        session=session,
        session_id=session_id,
        attendee_id=attendee.id,
        verification_method=VerificationMethod.qr_code,
    )
    if att_log is None:
        attendee_name = f"{attendee.first_name} {attendee.last_name}"
        return {"success": True, "attendee_name": attendee_name, "message": "Already checked in"}

    attendee_name = f"{attendee.first_name} {attendee.last_name}"
    await broadcast_to_session(
        str(session_id),
        {
            "event": "attendee_identified",
            "attendee_name": attendee_name,
            "attendee_id": str(attendee.id),
            "timestamp": att_log.verified_at.isoformat(),
            "verification_method": "qr_code",
        },
    )

    return {
        "success": True,
        "attendee_name": attendee_name,
        "message": f"Check-in successful! Welcome, {attendee_name}",
    }


async def manual_override(
    session: AsyncSession,
    session_id: uuid.UUID,
    attendee_id_str: str,
    marshal_id: uuid.UUID,
    reason: str | None = None,
) -> dict:
    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None:
        return {"success": False, "message": "Session not found"}
    if att_session.status != SessionStatus.active:
        return {"success": False, "message": "Session is not active"}

    event = await session.get(Event, att_session.event_id)
    event_org_id = event.organization_id if event else None

    attendee = await get_attendee_by_identifier(session, attendee_id_str)
    if attendee is None:
        return {"success": False, "message": "Attendee not found"}

    if not await is_attendee_member(session, attendee.id, event_org_id):
        return {"success": False, "message": "Not a member of this organization"}

    att_log = await log_attendance(
        session=session,
        session_id=session_id,
        attendee_id=attendee.id,
        verification_method=VerificationMethod.marshal_override,
        marshal_id=marshal_id,
        reason=reason,
    )
    if att_log is None:
        attendee_name = f"{attendee.first_name} {attendee.last_name}"
        return {"success": True, "attendee_name": attendee_name, "message": "Already checked in"}

    attendee_name = f"{attendee.first_name} {attendee.last_name}"
    await broadcast_to_session(
        str(session_id),
        {
            "event": "attendee_identified",
            "attendee_name": attendee_name,
            "attendee_id": str(attendee.id),
            "timestamp": att_log.verified_at.isoformat(),
            "verification_method": "marshal_override",
        },
    )

    return {
        "success": True,
        "attendee_name": attendee_name,
        "message": f"Attendance logged for {attendee_name}",
    }


async def get_live_stats(
    session: AsyncSession,
    session_id: uuid.UUID,
) -> dict:
    total_checked_in = await session.execute(
        select(func.count(func.distinct(AttendanceLog.attendee_id)))
        .where(AttendanceLog.session_id == session_id)
    )
    total_checked_in_val = total_checked_in.scalar() or 0

    att_session = await session.get(AttendanceSession, session_id)
    event_org_id = None
    if att_session:
        event = await session.get(Event, att_session.event_id)
        if event:
            event_org_id = event.organization_id

    if event_org_id:
        # Count members of the organization
        primary_count = (
            await session.execute(
                select(func.count(Attendee.id)).where(Attendee.organization_id == event_org_id)
            )
        ).scalar() or 0

        member_count = (
            await session.execute(
                select(func.count(func.distinct(Membership.attendee_id))).where(
                    Membership.organization_id == event_org_id
                )
            )
        ).scalar() or 0

        total_registered_val = primary_count + member_count
    else:
        total_registered = await session.execute(select(func.count(Attendee.id)))
        total_registered_val = total_registered.scalar() or 0

    recent_result = await session.execute(
        select(AttendanceLog, Attendee)
        .join(Attendee, AttendanceLog.attendee_id == Attendee.id)
        .where(AttendanceLog.session_id == session_id)
        .order_by(AttendanceLog.verified_at.desc())
        .limit(10)
    )
    recent_rows = recent_result.all()

    recent_check_ins = []
    for log, attendee in recent_rows:
        name = f"{attendee.first_name} {attendee.last_name}"
        recent_check_ins.append(
            {
                "attendee_name": name,
                "timestamp": log.verified_at,
                "method": log.verification_method.value,
            }
        )

    check_in_rate = (
        round((total_checked_in_val / total_registered_val) * 100, 1)
        if total_registered_val > 0
        else 0.0
    )

    return {
        "total_checked_in": total_checked_in_val,
        "total_registered": total_registered_val,
        "check_in_rate": check_in_rate,
        "recent_check_ins": recent_check_ins,
    }
