from app.database import get_session
from app.models.organization import Organization, OrgType
from app.schemas.department import DepartmentListResponse, DepartmentResponse
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("", response_model=DepartmentListResponse)
async def list_departments(
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Organization).where(Organization.org_type == OrgType.COLLEGE).order_by(Organization.code)
    )
    items = list(result.scalars().all())
    total = await session.execute(
        select(func.count(Organization.id)).where(Organization.org_type == OrgType.COLLEGE)
    )
    return DepartmentListResponse(
        items=[
            DepartmentResponse(id=str(d.id), name=d.name, code=d.code)
            for d in items
        ],
        total=total.scalar() or 0,
    )
