import uuid

from app.database import get_session
from app.middleware.auth import get_optional_user, require_admin
from app.models.attendee import Attendee, AttendeeType
from app.models.membership import MemberType, Membership
from app.models.organization import Organization, OrgType
from app.models.organization_staff import OrganizationStaff, OrgRole
from app.models.user import User, UserRole
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/organizations", tags=["Organizations"])


# Schemas
class OrganizationCreate(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=20)
    org_type: OrgType = OrgType.CLUB
    description: str | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    code: str
    org_type: str
    description: str | None = None
    member_count: int = 0

    model_config = {"from_attributes": True}


class MemberAddRequest(BaseModel):
    attendee_id: uuid.UUID
    member_type: MemberType = MemberType.STUDENT
    role: str = "Active Member"


class StaffAddRequest(BaseModel):
    user_id: uuid.UUID
    org_role: OrgRole = OrgRole.ADMIN


# CRUD Endpoints
@router.get("", response_model=list[OrganizationResponse])
async def list_organizations(
    org_type: OrgType | None = Query(None),
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
):
    query = select(Organization)
    if org_type:
        query = query.where(Organization.org_type == org_type)

    if current_user:
        if current_user.role != UserRole.super_admin and current_user.institution_id:
            query = query.where(Organization.institution_id == current_user.institution_id)

        if current_user.role not in [UserRole.admin, UserRole.ADMIN, UserRole.super_admin]:
            st_res = await db.execute(
                select(OrganizationStaff.organization_id).where(OrganizationStaff.user_id == current_user.id)
            )
            assigned_ids = st_res.scalars().all()
            query = query.where(Organization.id.in_(assigned_ids))

    result = await db.execute(query.order_by(Organization.name.asc()))
    orgs = result.scalars().all()

    if not orgs:
        return []

    org_ids = [org.id for org in orgs]

    # Batch compute counts with SQL func.count instead of N+1 scalar queries
    att_counts_stmt = (
        select(Attendee.organization_id, func.count(Attendee.id))
        .where(Attendee.organization_id.in_(org_ids))
        .group_by(Attendee.organization_id)
    )
    att_res = await db.execute(att_counts_stmt)
    primary_map = {row[0]: row[1] for row in att_res.all()}

    mem_counts_stmt = (
        select(Membership.organization_id, func.count(Membership.id))
        .where(Membership.organization_id.in_(org_ids))
        .group_by(Membership.organization_id)
    )
    mem_res = await db.execute(mem_counts_stmt)
    joined_map = {row[0]: row[1] for row in mem_res.all()}

    response = []
    for org in orgs:
        primary_count = primary_map.get(org.id, 0)
        joined_count = joined_map.get(org.id, 0)
        org_type_val = org.org_type.value if hasattr(org.org_type, "value") else str(org.org_type)

        response.append(
            OrganizationResponse(
                id=str(org.id),
                name=org.name,
                code=org.code,
                org_type=org_type_val,
                description=org.description,
                member_count=primary_count + joined_count,
            )
        )
    return response


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    inst_id = current_user.institution_id
    if not inst_id:
        inst_res = await db.execute(select(Institution.id).limit(1))
        inst_id = inst_res.scalar_one_or_none()

    if not inst_id:
        raise HTTPException(
            status_code=400,
            detail="An active university institution is required to create an organization.",
        )

    # Check code uniqueness within institution
    existing = await db.execute(
        select(Organization).where(
            Organization.institution_id == inst_id,
            Organization.code == payload.code.upper(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Organization code '{payload.code.upper()}' already exists in this institution.")

    org = Organization(
        institution_id=inst_id,
        name=payload.name,
        code=payload.code.upper(),
        org_type=payload.org_type,
        description=payload.description,
    )
    db.add(org)
    await db.commit()
    await db.refresh(org)

    org_type_val = org.org_type.value if hasattr(org.org_type, "value") else str(org.org_type)

    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        org_type=org_type_val,
        description=org.description,
        member_count=0,
    )


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    primary_count = (await db.execute(
        select(func.count(Attendee.id)).where(Attendee.organization_id == org.id)
    )).scalar() or 0

    joined_count = (await db.execute(
        select(func.count(Membership.id)).where(Membership.organization_id == org.id)
    )).scalar() or 0

    org_type_val = org.org_type.value if hasattr(org.org_type, "value") else str(org.org_type)

    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        org_type=org_type_val,
        description=org.description,
        member_count=primary_count + joined_count,
    )


@router.put("/{org_id}", response_model=OrganizationResponse)
async def update_organization(
    org_id: uuid.UUID,
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.name = payload.name
    org.code = payload.code.upper()
    org.org_type = payload.org_type
    org.description = payload.description

    await db.commit()
    await db.refresh(org)

    org_type_val = org.org_type.value if hasattr(org.org_type, "value") else str(org.org_type)

    return OrganizationResponse(
        id=str(org.id),
        name=org.name,
        code=org.code,
        org_type=org_type_val,
        description=org.description,
        member_count=0,
    )


@router.delete("/{org_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    await db.delete(org)
    await db.commit()
    return None


# Member Roster Management
@router.get("/{org_id}/members")
async def get_org_members(
    org_id: uuid.UUID,
    member_type: MemberType | None = Query(None),
    db: AsyncSession = Depends(get_session),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    members = []

    # Get primary attendees (home department)
    prim_query = select(Attendee).where(Attendee.organization_id == org_id)
    if member_type:
        prim_query = prim_query.where(Attendee.attendee_type == member_type.value)

    prim_res = await db.execute(prim_query)
    for att in prim_res.scalars().all():
        att_type_val = att.attendee_type.value if hasattr(att.attendee_type, "value") else str(att.attendee_type)
        members.append({
            "id": str(att.id),
            "identifier": att.identifier,
            "first_name": att.first_name,
            "last_name": att.last_name,
            "email": att.email,
            "attendee_type": att_type_val,
            "role": "Member (Primary)",
            "joined_at": att.created_at.isoformat() if att.created_at else None,
        })

    # Get joined memberships
    mem_query = select(Membership, Attendee).join(Attendee, Membership.attendee_id == Attendee.id).where(Membership.organization_id == org_id)
    if member_type:
        mem_query = mem_query.where(Membership.member_type == member_type)

    mem_res = await db.execute(mem_query)
    for mem, att in mem_res.all():
        if not any(m["id"] == str(att.id) for m in members):
            mem_type_val = mem.member_type.value if hasattr(mem.member_type, "value") else str(mem.member_type)
            members.append({
                "id": str(att.id),
                "identifier": att.identifier,
                "first_name": att.first_name,
                "last_name": att.last_name,
                "email": att.email,
                "attendee_type": mem_type_val,
                "role": mem.role or "Member",
                "joined_at": mem.joined_at.isoformat() if mem.joined_at else None,
            })

    return members


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: uuid.UUID,
    payload: MemberAddRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    attendee = await db.get(Attendee, payload.attendee_id)
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    existing = await db.execute(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.attendee_id == payload.attendee_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Attendee is already a member of this organization")

    membership = Membership(
        organization_id=org_id,
        attendee_id=payload.attendee_id,
        member_type=payload.member_type,
        role=payload.role,
    )
    db.add(membership)
    await db.commit()
    return {"message": "Member added successfully"}


@router.delete("/{org_id}/members/{attendee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: uuid.UUID,
    attendee_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    res = await db.execute(
        select(Membership).where(
            Membership.organization_id == org_id,
            Membership.attendee_id == attendee_id,
        )
    )
    membership = res.scalar_one_or_none()
    if membership:
        await db.delete(membership)
        await db.commit()

    return None


# Staff Management
@router.get("/{org_id}/staff")
async def get_org_staff(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    res = await db.execute(
        select(OrganizationStaff, User)
        .join(User, OrganizationStaff.user_id == User.id)
        .where(OrganizationStaff.organization_id == org_id)
    )
    staff = []
    for st, u in res.all():
        st_role = st.org_role.value if hasattr(st.org_role, "value") else str(st.org_role)
        staff.append({
            "id": str(st.id),
            "user_id": str(u.id),
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email": u.email,
            "org_role": st_role,
            "created_at": st.created_at.isoformat() if st.created_at else None,
        })
    return staff


@router.post("/{org_id}/staff", status_code=status.HTTP_201_CREATED)
async def add_org_staff(
    org_id: uuid.UUID,
    payload: StaffAddRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    user = await db.get(User, payload.user_id)
    if not user:
        # Check if an Attendee UUID was passed
        att = await db.get(Attendee, payload.user_id)
        if att:
            if att.user_id:
                user = await db.get(User, att.user_id)
            elif att.email:
                res = await db.execute(select(User).where(User.email == att.email))
                user = res.scalar_one_or_none()

            # Auto-create User account for attendee if none exists
            if not user:
                from app.utils.security import hash_password
                user_email = att.email or f"{att.identifier.lower()}@university.edu"
                target_role = UserRole.org_admin if payload.org_role == OrgRole.ADMIN else UserRole.marshal
                user = User(
                    email=user_email,
                    password_hash=hash_password("Password123!"),
                    first_name=att.first_name,
                    last_name=att.last_name,
                    role=target_role,
                )
                db.add(user)
                await db.flush()
                att.user_id = user.id

    if not user:
        raise HTTPException(status_code=404, detail="User account not found for this person")

    # Update role to org_admin (scoped) or marshal (scoped)
    if payload.org_role == OrgRole.ADMIN and user.role != UserRole.admin:
        user.role = UserRole.org_admin
    elif payload.org_role == OrgRole.MARSHAL and user.role not in [UserRole.admin, UserRole.org_admin, UserRole.marshal]:
        user.role = UserRole.marshal

    existing = await db.execute(
        select(OrganizationStaff).where(
            OrganizationStaff.organization_id == org_id,
            OrganizationStaff.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already an assigned officer for this organization")

    st = OrganizationStaff(
        organization_id=org_id,
        user_id=user.id,
        org_role=payload.org_role,
    )
    db.add(st)
    await db.commit()
    return {"message": f"Organization staff assigned successfully. User: {user.email}"}


@router.delete("/{org_id}/staff/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_org_staff(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_admin),
):
    res = await db.execute(
        select(OrganizationStaff).where(
            OrganizationStaff.organization_id == org_id,
            OrganizationStaff.user_id == user_id,
        )
    )
    st = res.scalar_one_or_none()
    if st:
        await db.delete(st)
        await db.commit()
    return None
