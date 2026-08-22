import uuid
from app.database import get_session
from app.middleware.auth import get_optional_user
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.user import User, UserRole
from app.schemas.department import DepartmentListResponse, DepartmentResponse
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=DepartmentListResponse)
async def list_departments(
    institution_id: uuid.UUID | None = Query(None, description="Filter departments by institution ID"),
    institution_slug: str | None = Query(None, description="Filter departments by institution slug/code"),
    org_type: str | None = Query(None, description="Filter by organization type (e.g. college, club)"),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
):
    target_inst_id: uuid.UUID | None = institution_id

    # If current user is authenticated and not super_admin, enforce their institution
    if current_user and current_user.role != UserRole.super_admin:
        if current_user.institution_id:
            target_inst_id = current_user.institution_id

    if not target_inst_id and institution_slug:
        clean_slug = institution_slug.lower().strip()
        # 1. Exact match
        inst_res = await session.execute(
            select(Institution).where(func.lower(Institution.code) == clean_slug)
        )
        target_inst = inst_res.scalar_one_or_none()

        # 2. Prefix match (e.g. "cjc" matching "cjc_27201f")
        if not target_inst:
            prefix_res = await session.execute(
                select(Institution).where(func.lower(Institution.code).startswith(clean_slug))
            )
            target_inst = prefix_res.scalar_one_or_none()

        if target_inst:
            target_inst_id = target_inst.id
        else:
            return DepartmentListResponse(items=[], total=0)

    if not target_inst_id:
        # Prevent cross-tenant leakage if no institution is authenticated or specified
        return DepartmentListResponse(items=[], total=0)

    query = select(Organization).where(Organization.institution_id == target_inst_id)
    count_query = select(func.count(Organization.id)).where(Organization.institution_id == target_inst_id)

    if org_type:
        try:
            ot = OrgType(org_type.lower().strip())
            query = query.where(Organization.org_type == ot)
            count_query = count_query.where(Organization.org_type == ot)
        except ValueError:
            pass

    query = query.order_by(Organization.name)
    result = await session.execute(query)
    items = list(result.scalars().all())
    total = (await session.execute(count_query)).scalar() or 0

    return DepartmentListResponse(
        items=[
            DepartmentResponse(id=str(d.id), name=d.name, code=d.code)
            for d in items
        ],
        total=total,
    )
