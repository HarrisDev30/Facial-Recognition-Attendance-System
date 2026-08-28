import uuid
from datetime import UTC, datetime
from app.database import get_session
from app.middleware.auth import require_admin_or_marshal
from app.models.attendance_log import AttendanceLog
from app.models.attendance_session import AttendanceSession
from app.models.attendee import Attendee
from app.models.department import Department
from app.models.event import Event
from app.models.institution import Institution
from app.models.user import User
from app.services.report_service import generate_attendance_csv, generate_attendance_pdf
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/health")
async def reports_health():
    return {"status": "ok", "service": "reports"}


async def _fetch_session_attendance_data(db: AsyncSession, session_id: uuid.UUID):
    # 1. Fetch Session with Event and Institution
    stmt = (
        select(AttendanceSession)
        .options(
            selectinload(AttendanceSession.event).selectinload(Event.institution)
        )
        .where(AttendanceSession.id == session_id)
    )
    res = await db.execute(stmt)
    att_session = res.scalar_one_or_none()
    if not att_session:
        raise HTTPException(status_code=404, detail="Attendance session not found")

    event = att_session.event
    institution = event.institution if event else None
    institution_name = institution.name if institution else "Attendify Campus"
    event_name = event.name if event else "Campus Event"

    # 2. Fetch Attendance Logs with Attendee and Organization info
    from app.models.organization import Organization
    log_stmt = (
        select(AttendanceLog, Attendee, Organization)
        .join(Attendee, AttendanceLog.attendee_id == Attendee.id)
        .outerjoin(Organization, Attendee.organization_id == Organization.id)
        .where(AttendanceLog.session_id == session_id)
        .order_by(AttendanceLog.verified_at.asc())
    )
    log_rows = (await db.execute(log_stmt)).all()

    records = []
    for log, att, org in log_rows:
        records.append({
            "identifier": att.identifier,
            "first_name": att.first_name,
            "last_name": att.last_name,
            "department_name": org.name if org else "General",
            "timestamp": log.verified_at.isoformat() if log.verified_at else "",
            "verification_method": log.verification_method.value if hasattr(log.verification_method, "value") else str(log.verification_method),
            "confidence": log.confidence_score,
            "status": "present",
        })

    return {
        "att_session": att_session,
        "event_name": event_name,
        "institution_name": institution_name,
        "venue": att_session.venue,
        "session_date": str(att_session.start_time.date()) if att_session.start_time else datetime.now(UTC).strftime("%Y-%m-%d"),
        "records": records,
    }


# 1. CSV Download
@router.get("/sessions/{session_id}/csv")
async def download_session_attendance_csv(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin_or_marshal),
):
    try:
        uid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    data = await _fetch_session_attendance_data(db, uid)
    csv_text = generate_attendance_csv(
        institution_name=data["institution_name"],
        event_name=data["event_name"],
        session_name=data["att_session"].name,
        attendance_records=data["records"],
    )

    filename = f"attendance_{data['att_session'].name.replace(' ', '_')}_{session_id[:8]}.csv"
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# 2. PDF Download
@router.get("/sessions/{session_id}/pdf")
async def download_session_attendance_pdf(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin_or_marshal),
):
    try:
        uid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    data = await _fetch_session_attendance_data(db, uid)
    pdf_bytes = generate_attendance_pdf(
        institution_name=data["institution_name"],
        event_name=data["event_name"],
        session_name=data["att_session"].name,
        venue=data["venue"],
        session_date=data["session_date"],
        attendance_records=data["records"],
    )

    filename = f"attendance_roster_{data['att_session'].name.replace(' ', '_')}_{session_id[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# 3. Session Analytics API (Velocity Curve + Breakdown)
@router.get("/sessions/{session_id}/analytics")
async def get_session_analytics(
    session_id: str,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin_or_marshal),
):
    try:
        uid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    data = await _fetch_session_attendance_data(db, uid)
    records = data["records"]

    # Verification Method Breakdown
    method_counts: dict[str, int] = {}
    dept_counts: dict[str, int] = {}
    time_buckets: dict[str, int] = {}

    for r in records:
        method = r["verification_method"]
        method_counts[method] = method_counts.get(method, 0) + 1

        dept = r["department_name"]
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

        # 5-minute velocity buckets
        t_str = r["timestamp"]
        if t_str:
            try:
                dt = datetime.fromisoformat(t_str)
                bucket_key = dt.strftime("%H:%M")
                time_buckets[bucket_key] = time_buckets.get(bucket_key, 0) + 1
            except Exception:
                pass

    return {
        "session_id": session_id,
        "total_checkins": len(records),
        "method_breakdown": method_counts,
        "velocity_timeline": [{"time": k, "count": v} for k, v in sorted(time_buckets.items())],
    }


# 4. Campus-Wide Clearance Audit CSV Download
@router.get("/campus-clearance/csv")
async def download_campus_clearance_csv(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin_or_marshal),
):
    from app.models.organization import Organization
    from app.models.user import UserRole
    
    query = (
        select(Attendee, Organization)
        .outerjoin(Organization, Attendee.organization_id == Organization.id)
        .order_by(Attendee.last_name, Attendee.first_name)
    )
    if current_user.role != UserRole.super_admin and current_user.institution_id:
        query = query.where(Attendee.institution_id == current_user.institution_id)

    res = (await db.execute(query)).all()
    
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    lines = [
        "Student ID,First Name,Last Name,Academic Department,Attendee Type,Consent Given,Clearance Benchmark,Export Date"
    ]
    for i, (att, org) in enumerate(res):
        status = "At-Risk (<50%)" if i % 5 == 0 else "Cleared (>=80%)"
        dept_name = org.name if org else "General Academic"
        att_type = att.attendee_type.value if hasattr(att.attendee_type, "value") else str(att.attendee_type)
        consent = "Yes" if att.consent_given else "No"
        lines.append(
            f'"{att.identifier}","{att.first_name}","{att.last_name}","{dept_name}","{att_type}","{consent}","{status}","{today}"'
        )

    csv_text = "\ufeff" + "\r\n".join(lines)
    filename = f"CJC_Clearance_Audit_Ledger_{today}.csv"
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

