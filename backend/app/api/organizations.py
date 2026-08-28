import uuid

from app.database import get_session
from app.middleware.auth import DomainScope, get_current_user, get_domain_scope, get_optional_user, require_admin
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
    parent_id: uuid.UUID | None = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    code: str
    org_type: str
    description: str | None = None
    member_count: int = 0
    parent_id: str | None = None
    parent_name: str | None = None
    parent_code: str | None = None
    children_count: int = 0

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
    parent_id: uuid.UUID | None = Query(None),
    db: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
    scope: DomainScope = Depends(get_domain_scope),
):
    query = select(Organization)
    if org_type:
        query = query.where(Organization.org_type == org_type)
    if parent_id:
        query = query.where(Organization.parent_id == parent_id)

    if current_user:
        if current_user.role != UserRole.super_admin and current_user.institution_id:
            query = query.where(Organization.institution_id == current_user.institution_id)

        if current_user.role not in [UserRole.admin, UserRole.ADMIN, UserRole.super_admin]:
            query = query.where(Organization.id.in_(scope.assigned_org_ids))

    result = await db.execute(query.order_by(Organization.name.asc()))
    orgs = result.scalars().all()

    if not orgs:
        return []

    org_ids = [org.id for org in orgs]
    parent_ids = [org.parent_id for org in orgs if org.parent_id]

    # Batch load parent organizations
    parent_map = {}
    if parent_ids:
        parent_stmt = select(Organization).where(Organization.id.in_(parent_ids))
        parent_res = await db.execute(parent_stmt)
        parent_map = {p.id: p for p in parent_res.scalars().all()}

    # Batch child counts
    children_counts_stmt = (
        select(Organization.parent_id, func.count(Organization.id))
        .where(Organization.parent_id.in_(org_ids))
        .group_by(Organization.parent_id)
    )
    children_res = await db.execute(children_counts_stmt)
    children_map = {row[0]: row[1] for row in children_res.all()}

    # Batch compute member counts with SQL func.count instead of N+1 scalar queries
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
        child_count = children_map.get(org.id, 0)
        parent_org = parent_map.get(org.parent_id)
        org_type_val = org.org_type.value if hasattr(org.org_type, "value") else str(org.org_type)

        response.append(
            OrganizationResponse(
                id=str(org.id),
                name=org.name,
                code=org.code,
                org_type=org_type_val,
                description=org.description,
                member_count=primary_count + joined_count,
                parent_id=str(org.parent_id) if org.parent_id else None,
                parent_name=parent_org.name if parent_org else None,
                parent_code=parent_org.code if parent_org else None,
                children_count=child_count,
            )
        )
    return response


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not (scope.is_admin_or_higher or scope.is_org_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to create an organization",
        )

    inst_id = current_user.institution_id
    if not inst_id:
        from app.models.institution import Institution
        inst_res = await db.execute(select(Institution.id).limit(1))
        inst_id = inst_res.scalar_one_or_none()

    if not inst_id:
        raise HTTPException(
            status_code=400,
            detail="An active university institution is required to create an organization.",
        )

    # If Org Admin (not central campus admin), must be creating a sub-organization under an assigned parent department
    parent_org = None
    is_central_admin = scope.is_super_admin or scope.is_institution_admin
    if not is_central_admin:
        target_parent_id = payload.parent_id
        if not target_parent_id:
            # If caller manages exactly 1 department, default to it
            if len(scope.assigned_org_ids) == 1:
                target_parent_id = scope.assigned_org_ids[0]
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Department Admins must specify a parent department for new clubs or offices.",
                )

        scope.assert_can_manage_org(target_parent_id)
        parent_org = await db.get(Organization, target_parent_id)
        if not parent_org or parent_org.institution_id != inst_id:
            raise HTTPException(status_code=404, detail="Parent department not found")
        payload.parent_id = target_parent_id
    elif payload.parent_id:
        parent_org = await db.get(Organization, payload.parent_id)
        if not parent_org or (current_user.role != UserRole.super_admin and parent_org.institution_id != inst_id):
            raise HTTPException(status_code=404, detail="Parent department not found")

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
        parent_id=payload.parent_id,
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
        parent_id=str(org.parent_id) if org.parent_id else None,
        parent_name=parent_org.name if parent_org else None,
        parent_code=parent_org.code if parent_org else None,
        children_count=0,
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
    prim_query = (
        select(Attendee, Organization)
        .outerjoin(Organization, Attendee.organization_id == Organization.id)
        .where(Attendee.organization_id == org_id)
    )
    if member_type:
        prim_query = prim_query.where(Attendee.attendee_type == member_type.value)

    prim_res = await db.execute(prim_query)
    for att, home_org in prim_res.all():
        att_type_val = att.attendee_type.value if hasattr(att.attendee_type, "value") else str(att.attendee_type)
        members.append({
            "id": str(att.id),
            "identifier": att.identifier,
            "first_name": att.first_name,
            "last_name": att.last_name,
            "email": att.email,
            "attendee_type": att_type_val,
            "role": "Primary Member",
            "home_department_name": home_org.name if home_org else None,
            "home_department_code": home_org.code if home_org else None,
            "joined_at": att.created_at.isoformat() if att.created_at else None,
        })

    # Get joined memberships (cross-department members)
    mem_query = (
        select(Membership, Attendee, Organization)
        .join(Attendee, Membership.attendee_id == Attendee.id)
        .outerjoin(Organization, Attendee.organization_id == Organization.id)
        .where(Membership.organization_id == org_id)
    )
    if member_type:
        mem_query = mem_query.where(Membership.member_type == member_type)

    mem_res = await db.execute(mem_query)
    for mem, att, home_org in mem_res.all():
        if not any(m["id"] == str(att.id) for m in members):
            mem_type_val = mem.member_type.value if hasattr(mem.member_type, "value") else str(mem.member_type)
            members.append({
                "id": str(att.id),
                "identifier": att.identifier,
                "first_name": att.first_name,
                "last_name": att.last_name,
                "email": att.email,
                "attendee_type": mem_type_val,
                "role": mem.role or "Active Member",
                "home_department_name": home_org.name if home_org else None,
                "home_department_code": home_org.code if home_org else None,
                "joined_at": mem.joined_at.isoformat() if mem.joined_at else None,
            })

    return members


@router.post("/{org_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: uuid.UUID,
    payload: MemberAddRequest,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    scope.assert_can_manage_org(org_id)

    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    attendee = await db.get(Attendee, payload.attendee_id)
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")

    # Faculty Office membership is restricted to faculty/staff of that department
    if org.org_type == OrgType.OFFICE:
        if attendee.attendee_type not in (AttendeeType.staff, AttendeeType.faculty):
            raise HTTPException(
                status_code=400,
                detail="Department offices are restricted to faculty and staff members",
            )
        parent_target = org.parent_id or org.id
        if attendee.organization_id != parent_target:
            raise HTTPException(
                status_code=400,
                detail="Faculty office members must belong to the parent department",
            )

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
    scope: DomainScope = Depends(get_domain_scope),
):
    scope.assert_can_manage_org(org_id)
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
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    scope.assert_can_manage_org(org_id)

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
                    institution_id=org.institution_id,
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


@router.get("/staff/all")
async def list_all_campus_staff(
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    stmt = (
        select(
            OrganizationStaff,
            User,
            Organization,
            Attendee
        )
        .join(User, OrganizationStaff.user_id == User.id)
        .join(Organization, OrganizationStaff.organization_id == Organization.id)
        .outerjoin(Attendee, User.id == Attendee.user_id)
        .order_by(Organization.name.asc(), User.last_name.asc())
    )

    if not scope.is_super_admin and scope.institution_id:
        stmt = stmt.where(Organization.institution_id == scope.institution_id)

    res = await db.execute(stmt)
    rows = res.all()

    items = []
    for staff, user, org, att in rows:
        role_str = staff.org_role.value if hasattr(staff.org_role, "value") else str(staff.org_role)
        is_student_marshal = (user.role == UserRole.student) or (att and att.attendee_type == AttendeeType.student)
        display_role = "Student Marshal" if (role_str == "marshal" and is_student_marshal) else ("Field Marshal" if role_str == "marshal" else "Department Admin")
        
        items.append({
            "id": str(staff.id),
            "user_id": str(user.id),
            "name": f"{user.first_name or (att.first_name if att else '')} {user.last_name or (att.last_name if att else '')}".strip() or user.email,
            "email": user.email,
            "org_role": role_str,
            "display_role": display_role,
            "is_student_marshal": is_student_marshal,
            "student_identifier": att.identifier if att else None,
            "organization_id": str(org.id),
            "organization_name": org.name,
            "organization_code": org.code,
            "org_type": org.org_type.value if hasattr(org.org_type, "value") else str(org.org_type),
        })

    return items


@router.delete("/{org_id}/staff/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_org_staff(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    scope: DomainScope = Depends(get_domain_scope),
):
    if not scope.is_admin_or_higher:
        raise HTTPException(status_code=403, detail="Admin privileges required")

    scope.assert_can_manage_org(org_id)

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
