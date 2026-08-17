import uuid

from app.database import get_session
from app.middleware.auth import get_current_user, require_admin
from app.models.attendee import Attendee, AttendeeType
from app.models.organization import Organization
from app.models.organization_staff import OrganizationStaff
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
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

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


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    attendee_result = await session.execute(
        select(Attendee).where(Attendee.user_id == user.id)
    )
    attendee = attendee_result.scalar_one_or_none()
    assigned_orgs = await _get_assigned_org_ids(session, user.id)

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

    token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": role_val,
            "attendee_id": str(attendee.id) if attendee else None,
            "assigned_org_ids": assigned_orgs,
        }
    )
    return TokenResponse(
        access_token=token,
        user=UserProfileResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name or (attendee.first_name if attendee else None),
            last_name=user.last_name or (attendee.last_name if attendee else None),
            role=role_val,
            attendee_id=str(attendee.id) if attendee else None,
            attendee_type=attendee.attendee_type.value if attendee and hasattr(attendee.attendee_type, 'value') else str(attendee.attendee_type) if attendee else None,
            profile_photo_url=attendee.profile_photo_url if attendee else None,
            assigned_org_ids=assigned_orgs,
        ),
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

    if body.identifier:
        existing_id = await session.execute(
            select(Attendee).where(Attendee.identifier == body.identifier)
        )
        if existing_id.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{identifier_label} already registered",
            )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=role,
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
        user_id=user.id,
        identifier=body.identifier or str(user.id),
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        attendee_type=attendee_type,
        organization_id=dept_id,
    )
    session.add(attendee)
    assigned_orgs = await _get_assigned_org_ids(session, user.id)
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)

    token = create_access_token(
        {
            "sub": str(user.id),
            "email": user.email,
            "role": role_val,
            "attendee_id": str(attendee.id),
            "assigned_org_ids": assigned_orgs,
        }
    )

    return TokenResponse(
        access_token=token,
        user=UserProfileResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=role_val,
            attendee_id=str(attendee.id),
            attendee_type=attendee.attendee_type.value if hasattr(attendee.attendee_type, "value") else str(attendee.attendee_type),
            profile_photo_url=attendee.profile_photo_url,
            assigned_org_ids=assigned_orgs,
        ),
    )


@router.post("/register", response_model=UserResponse)
async def register(
    body: RegisterRequest,
    session: AsyncSession = Depends(get_session),
    _: User = Depends(require_admin),
):
    result = await session.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        role=UserRole(body.role),
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
    )


@router.get("/me", response_model=UserProfileResponse)
async def me(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    attendee_result = await session.execute(
        select(Attendee).where(Attendee.user_id == current_user.id)
    )
    attendee = attendee_result.scalar_one_or_none()
    assigned_orgs = await _get_assigned_org_ids(session, current_user.id)

    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)

    return UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        first_name=current_user.first_name or (attendee.first_name if attendee else None),
        last_name=current_user.last_name or (attendee.last_name if attendee else None),
        role=role_val,
        attendee_id=str(attendee.id) if attendee else None,
        attendee_type=attendee.attendee_type.value if attendee and hasattr(attendee.attendee_type, 'value') else str(attendee.attendee_type) if attendee else None,
        profile_photo_url=attendee.profile_photo_url if attendee else None,
        assigned_org_ids=assigned_orgs,
    )
