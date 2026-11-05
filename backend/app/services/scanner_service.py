import time
import uuid
from collections import defaultdict
from datetime import UTC, datetime

from app.config import settings
from app.models.attendance_log import AttendanceLog, VerificationMethod
from app.models.attendance_session import AttendanceSession, SessionStatus
from app.models.attendee import Attendee
from app.models.event import Event
from app.models.membership import Membership
from app.services import face_recognition
from app.services.attendance_service import has_existing_log, log_attendance
from app.services.attendee_service import get_attendee_by_identifier
from app.services.faiss_index import (
    batch_search_institution as faiss_batch_search_institution,
    ensure_institution_index_loaded,
    is_institution_ready as faiss_is_institution_ready,
)
from app.services.websocket_manager import broadcast_to_session
from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

_cooldown_cache: dict[str, float] = {}
_checked_in_cache: dict[str, bool] = {}
_session_checked_in: dict[str, set[uuid.UUID]] = defaultdict(set)
_attendee_name_cache: dict[uuid.UUID, str] = {}

_face_tracker: dict[str, list[dict]] = defaultdict(list)
_TRACKER_TTL_SECONDS = 2.0
_TRACKER_IOU_THRESHOLD = 0.5


async def dispatch_checkin_notification(
    user_id: uuid.UUID,
    event_title: str,
) -> None:
    try:
        from app.database import get_session_ctx
        from app.models.notification import NotificationType
        from app.services import notification_service

        async with get_session_ctx() as bg_session:
            await notification_service.create_notification(
                session=bg_session,
                user_id=user_id,
                title=f"Attendance Verified: {event_title}",
                message=f"You have successfully checked in for '{event_title}' via facial recognition.",
                notification_type=NotificationType.attendance_checkin,
                link_url="/student/attendance",
            )
    except Exception:
        pass


def clear_scanner_cache(session_id: uuid.UUID | str | None = None) -> None:
    if session_id is not None:
        key = str(session_id)
        _session_checked_in.pop(key, None)
        _face_tracker.pop(key, None)
    else:
        _session_checked_in.clear()
        _face_tracker.clear()
        _cooldown_cache.clear()
        _checked_in_cache.clear()
        _attendee_name_cache.clear()


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


async def batch_verify_memberships(
    session: AsyncSession,
    attendees: list[Attendee],
    event: Event | None = None,
    organization_id: uuid.UUID | None = None,
) -> set[uuid.UUID]:
    if not attendees:
        return set()

    if event:
        scope = getattr(event.target_scope, "value", str(event.target_scope or "department_only"))
        if scope == "all":
            return {att.id for att in attendees}

        allowed_ids: set[str] = set()
        if event.organization_id:
            allowed_ids.add(str(event.organization_id))
        if scope == "selected_departments" and event.co_host_dept_ids:
            for item in event.co_host_dept_ids:
                if _is_valid_uuid(item):
                    allowed_ids.add(str(item))

        verified = {att.id for att in attendees if str(att.organization_id) in allowed_ids}
        remaining = [att.id for att in attendees if att.id not in verified]
        valid_uuids = [uuid.UUID(i) for i in allowed_ids if _is_valid_uuid(i)]

        if remaining and valid_uuids:
            res = await session.execute(
                select(Membership.attendee_id).where(
                    Membership.attendee_id.in_(remaining),
                    Membership.organization_id.in_(valid_uuids),
                )
            )
            for m_aid in res.scalars().all():
                verified.add(m_aid)
        return verified

    if not organization_id:
        return {att.id for att in attendees}

    verified = {att.id for att in attendees if att.organization_id == organization_id}
    remaining = [att.id for att in attendees if att.id not in verified]
    if remaining:
        res = await session.execute(
            select(Membership.attendee_id).where(
                Membership.attendee_id.in_(remaining),
                Membership.organization_id == organization_id,
            )
        )
        for m_aid in res.scalars().all():
            verified.add(m_aid)
    return verified


async def process_frame(
    session: AsyncSession,
    session_id: uuid.UUID,
    image_bytes: bytes,
    background_tasks: BackgroundTasks | None = None,
) -> dict:
    result = {
        "face_count": 0,
        "identified": False,
        "new_checkin_count": 0,
        "identifications": [],
    }

    att_session = await session.get(AttendanceSession, session_id)
    if att_session is None or att_session.status != SessionStatus.active:
        return result

    # Strict Time-Gated Window Enforcement (UTC)
    now_dt = datetime.now(UTC)
    if att_session.end_time:
        end_time_utc = att_session.end_time if att_session.end_time.tzinfo else att_session.end_time.replace(tzinfo=UTC)
        if now_dt > end_time_utc:
            # Auto-close expired session
            att_session.status = SessionStatus.completed
            att_session.deactivated_at = now_dt
            await session.commit()
            try:
                await broadcast_to_session(
                    session_id,
                    {
                        "type": "session_expired",
                        "session_id": str(session_id),
                        "message": "Attendance session has concluded.",
                    },
                )
            except Exception:
                pass
            result["session_expired"] = True
            result["message"] = "Attendance session has ended."
            return result

    if att_session.start_time:
        start_time_utc = att_session.start_time if att_session.start_time.tzinfo else att_session.start_time.replace(tzinfo=UTC)
        if now_dt < start_time_utc:
            result["session_not_started"] = True
            result["message"] = "Attendance session has not started yet."
            return result

    event = await session.get(Event, att_session.event_id)
    if not event or not event.institution_id:
        return result
    institution_id = event.institution_id
    event_org_id = event.organization_id

    face_data = await face_recognition.extract_embeddings(
        image_bytes, min_det_score=settings.insightface_min_det_score
    )

    result["face_count"] = len(face_data)
    if not face_data:
        return result

    threshold = att_session.confidence_threshold or settings.default_confidence_threshold
    if not faiss_is_institution_ready(institution_id):
        await ensure_institution_index_loaded(session, institution_id)

    if not faiss_is_institution_ready(institution_id):
        return result

    session_key = str(session_id)
    now = time.time()

    # In-memory active session check-in cache initialization
    if session_key not in _session_checked_in:
        existing_logs = await session.execute(
            select(AttendanceLog.attendee_id, Attendee.first_name, Attendee.last_name)
            .join(Attendee, AttendanceLog.attendee_id == Attendee.id, isouter=True)
            .where(AttendanceLog.session_id == session_id)
        )
        s: set[uuid.UUID] = set()
        for row in existing_logs.all():
            aid = row[0]
            s.add(aid)
            if row[1] is not None:
                _attendee_name_cache[aid] = f"{row[1]} {row[2]}".strip()
        _session_checked_in[session_key] = s

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
        batch_results = faiss_batch_search_institution(
            institution_id, embeddings, threshold, min_margin=settings.min_match_margin
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

    pending_notifications: list[dict] = []
    unverified_candidates: list[tuple[int, uuid.UUID, float, list[int]]] = []

    for idx, matched_attendee_id, match_score, bbox in tracked_matches:
        cache_key = f"{session_id}:{matched_attendee_id}"
        last_seen = _cooldown_cache.get(cache_key)

        # 1. Immediate sub-millisecond O(1) check if already checked in
        if matched_attendee_id in _session_checked_in[session_key]:
            # Set cooldown to 10 seconds for already checked-in attendees
            if last_seen and (now - last_seen) < 10.0:
                result["identifications"].append(
                    {
                        "index": idx,
                        "attendee_id": str(matched_attendee_id),
                        "message": "On cooldown",
                        "bbox": bbox,
                    }
                )
                continue

            _cooldown_cache[cache_key] = now
            _checked_in_cache[cache_key] = True
            attendee_name = _attendee_name_cache.get(matched_attendee_id)
            ident = {
                "index": idx,
                "attendee_id": str(matched_attendee_id),
                "confidence_score": match_score,
                "already_checked_in": True,
                "message": "Already checked in",
                "bbox": bbox,
            }
            if attendee_name:
                ident["attendee_name"] = attendee_name
            result["identifications"].append(ident)
            continue

        # Check cooldown for non-checked-in attendees
        cooldown_sec = settings.cooldown_seconds
        if last_seen and (now - last_seen) < cooldown_sec:
            result["identifications"].append(
                {
                    "index": idx,
                    "attendee_id": str(matched_attendee_id),
                    "message": "On cooldown",
                    "bbox": bbox,
                }
            )
            continue

        unverified_candidates.append((idx, matched_attendee_id, match_score, bbox))

    if unverified_candidates:
        needed_ids = list({att_id for _, att_id, _, _ in unverified_candidates})
        att_stmt = select(Attendee).where(Attendee.id.in_(needed_ids))
        att_res = await session.execute(att_stmt)
        attendees_by_id = {att.id: att for att in att_res.scalars().all()}

        for att in attendees_by_id.values():
            _attendee_name_cache[att.id] = f"{att.first_name} {att.last_name}".strip()

        verified_ids = await batch_verify_memberships(
            session,
            list(attendees_by_id.values()),
            event=event,
            organization_id=event_org_id,
        )

        for idx, matched_attendee_id, match_score, bbox in unverified_candidates:
            cache_key = f"{session_id}:{matched_attendee_id}"
            attendee = attendees_by_id.get(matched_attendee_id)
            if attendee is None:
                result["identifications"].append(
                    {
                        "index": idx,
                        "attendee_id": str(matched_attendee_id),
                        "message": "Attendee record not found",
                        "bbox": bbox,
                    }
                )
                continue

            attendee_name = f"{attendee.first_name} {attendee.last_name}".strip()

            if matched_attendee_id not in verified_ids:
                result["identifications"].append(
                    {
                        "index": idx,
                        "attendee_id": str(matched_attendee_id),
                        "attendee_name": attendee_name,
                        "message": "Attendance Denied — Restricted to authorized department students",
                        "bbox": bbox,
                    }
                )
                continue

            if matched_attendee_id in _session_checked_in[session_key]:
                _cooldown_cache[cache_key] = now
                _checked_in_cache[cache_key] = True
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
                _session_checked_in[session_key].add(matched_attendee_id)
                _checked_in_cache[cache_key] = True
                _cooldown_cache[cache_key] = now
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

            _session_checked_in[session_key].add(matched_attendee_id)
            _checked_in_cache[cache_key] = True
            _cooldown_cache[cache_key] = now
            result["identified"] = True
            result["new_checkin_count"] += 1

            event_title = event.name if event else "Session"
            if attendee.user_id:
                notif_item = {
                    "user_id": attendee.user_id,
                    "event_title": event_title,
                }
                pending_notifications.append(notif_item)
                if background_tasks is not None:
                    background_tasks.add_task(
                        dispatch_checkin_notification,
                        attendee.user_id,
                        event_title,
                    )

            result["identifications"].append(
                {
                    "index": idx,
                    "attendee_id": str(matched_attendee_id),
                    "attendee_name": attendee_name,
                    "confidence_score": match_score,
                    "already_checked_in": False,
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

    if result["new_checkin_count"] > 0:
        await session.commit()

    result["identifications"].sort(key=lambda x: x.get("index", 0))
    result["pending_notifications"] = pending_notifications
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
    attendee_name = f"{attendee.first_name} {attendee.last_name}".strip()
    _session_checked_in[str(session_id)].add(attendee.id)
    _attendee_name_cache[attendee.id] = attendee_name
    _checked_in_cache[f"{session_id}:{attendee.id}"] = True

    if att_log is None:
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
    attendee_name = f"{attendee.first_name} {attendee.last_name}".strip()
    _session_checked_in[str(session_id)].add(attendee.id)
    _attendee_name_cache[attendee.id] = attendee_name
    _checked_in_cache[f"{session_id}:{attendee.id}"] = True

    if att_log is None:
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
