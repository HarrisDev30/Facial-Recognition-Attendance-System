import uuid

from app.database import get_session
from app.middleware.auth import get_current_user, require_admin
from app.models.attendee import Attendee, AttendeeType
from app.models.institution import Institution
from app.models.organization import Organization
from app.models.organization_staff import OrganizationStaff, OrgRole
from app.models.user import User, UserRole
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    RegisterStaffRequest,
    RegisterStudentRequest,
    TokenResponse,
    UserProfileResponse,
    UserResponse,
)
from app.services.auth_service import create_access_token
from app.utils.security import hash_password, verify_password
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _get_assigned_org_ids(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    res = await session.execute(
        select(OrganizationStaff.organization_id).where(OrganizationStaff.user_id == user_id)
    )
    org_ids = [str(org_id) for org_id in res.scalars().all()]
    if not org_ids:
        att_res = await session.execute(
            select(Attendee.organization_id).where(Attendee.user_id == user_id)
        )
        att_org_id = att_res.scalar_one_or_none()
        if att_org_id:
            org_ids.append(str(att_org_id))
    return org_ids


async def _get_marshal_org_ids(session: AsyncSession, user_id: uuid.UUID) -> list[str]:
    res = await session.execute(
        select(OrganizationStaff.organization_id).where(
            OrganizationStaff.user_id == user_id,
            OrganizationStaff.org_role.in_([OrgRole.MARSHAL, OrgRole.ADMIN]),
        )
    )
    return [str(org_id) for org_id in res.scalars().all()]


async def _build_user_profile(
    session: AsyncSession,
    user: User,
    institution: Institution | None = None,
    attendee: Attendee | None = None,
) -> UserProfileResponse:
    assigned_orgs = await _get_assigned_org_ids(session, user.id)
    marshal_orgs = await _get_marshal_org_ids(session, user.id)
    is_marshal_role = user.role in (UserRole.marshal, UserRole.admin, UserRole.super_admin, UserRole.org_admin)
    is_marshal = is_marshal_role or len(marshal_orgs) > 0
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

    inst_id = str(user.institution_id) if user.institution_id else (str(institution.id) if institution else None)
    inst_name = institution.name if institution else None
    inst_code = institution.code if institution else None

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name or (attendee.first_name if attendee else None),
        last_name=user.last_name or (attendee.last_name if attendee else None),
        role=role_val,
        institution_id=inst_id,
        institution_name=inst_name,
        institution_code=inst_code,
        attendee_id=str(attendee.id) if attendee else None,
        attendee_type=attendee.attendee_type.value if attendee and hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type) if attendee else None,
        profile_photo_url=attendee.profile_photo_url if attendee else None,
        assigned_org_ids=assigned_orgs,
        is_marshal=is_marshal,
        marshal_org_ids=marshal_orgs,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(User, Institution, Attendee)
        .outerjoin(Institution, User.institution_id == Institution.id)
        .outerjoin(Attendee, User.id == Attendee.user_id)
        .where(User.email == body.email)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, password, or institution portal.",
        )

    user, institution, attendee = row
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, password, or institution portal.",
        )

    # Tenant portal scope validation for non-super admins
    if body.institution_slug and user.role != UserRole.super_admin:
        clean_slug = body.institution_slug.strip().lower()
        inst_res = await session.execute(
            select(Institution).where(func.lower(Institution.code) == clean_slug)
        )
        target_inst = inst_res.scalar_one_or_none()

        user_inst_id = user.institution_id
        if not user_inst_id:
            att_res = await session.execute(
                select(Attendee).options(selectinload(Attendee.organization)).where(Attendee.user_id == user.id)
            )
            att = att_res.scalar_one_or_none()
            if att and att.organization and att.organization.institution_id:
                user_inst_id = att.organization.institution_id

        if not target_inst or (user_inst_id and user_inst_id != target_inst.id):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="This account does not belong to this campus portal. Please log in through your institution portal.",
            )

    user_profile = await _build_user_profile(session, user, institution, attendee)
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

    token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": role_val,
            "institution_id": str(user.institution_id) if user.institution_id else None,
            "institution_code": institution.code if institution else None,
            "attendee_id": str(attendee.id) if attendee else None,
            "assigned_org_ids": user_profile.assigned_org_ids,
            "is_marshal": user_profile.is_marshal,
            "marshal_org_ids": user_profile.marshal_org_ids,
        }
    )
    return TokenResponse(
        access_token=token,
        user=user_profile,
    )


@router.post("/register/student", status_code=status.HTTP_201_CREATED)
async def register_student(
    body: RegisterStudentRequest,
    session: AsyncSession = Depends(get_session),
):
    return await _register_attendee(
        session, body, UserRole.student, AttendeeType.student, "Student ID"
    )


@router.post("/register/staff", status_code=status.HTTP_201_CREATED)
async def register_staff(
    body: RegisterStaffRequest,
    session: AsyncSession = Depends(get_session),
):
    return await _register_attendee(
        session, body, UserRole.staff, AttendeeType.staff, "Employee ID"
    )


async def _register_attendee(
    session: AsyncSession,
    body: RegisterStudentRequest | RegisterStaffRequest,
    role: UserRole,
    attendee_type: AttendeeType,
    identifier_label: str,
) -> dict:
    if body.password != body.password_confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    dept_id = uuid.UUID(body.department_id)
    org = await session.get(Organization, dept_id)
    if org is None:
        raise HTTPException(status_code=404, detail="Department or organization not found")

    institution_id = org.institution_id

    if body.identifier:
        existing_id = await session.execute(
            select(Attendee).where(
                Attendee.identifier == body.identifier,
                Attendee.institution_id == institution_id,
            )
        )
        if existing_id.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{identifier_label} already registered in this institution",
            )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=role,
        institution_id=institution_id,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    attendee = Attendee(
        institution_id=institution_id,
        user_id=user.id,
        identifier=body.identifier or str(user.id),
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        attendee_type=attendee_type,
        organization_id=dept_id,
    )
    session.add(attendee)
    await session.flush()

    institution = await session.get(Institution, institution_id)
    user_profile = await _build_user_profile(session, user, institution, attendee)
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

    token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": role_val,
            "institution_id": str(institution_id),
            "institution_code": institution.code if institution else None,
            "attendee_id": str(attendee.id),
            "assigned_org_ids": user_profile.assigned_org_ids,
            "is_marshal": user_profile.is_marshal,
            "marshal_org_ids": user_profile.marshal_org_ids,
        }
    )

    return TokenResponse(
        access_token=token,
        user=user_profile,
    )


@router.post("/register", response_model=UserResponse)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
    current_admin: User = Depends(require_admin),
):
    result = await session.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Super admin can assign any institution or none; regular admin assigns their own institution
    target_institution_id = current_admin.institution_id
    if current_admin.role == UserRole.super_admin and body.institution_id:
        target_institution_id = uuid.UUID(body.institution_id)

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=UserRole(body.role),
        institution_id=target_institution_id,
    )
    session.add(user)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        institution_id=str(user.institution_id) if user.institution_id else None,
    )


@router.get("/me", response_model=UserProfileResponse)
async def me(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    from app.api.attendees import _get_attendee_for_user
    attendee = await _get_attendee_for_user(session, current_user)

    institution = None
    if current_user.institution_id:
        institution = await session.get(Institution, current_user.institution_id)

    return await _build_user_profile(session, current_user, institution, attendee)
