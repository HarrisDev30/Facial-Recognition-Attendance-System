import uuid
from datetime import datetime

from app.database import get_session
from app.middleware.auth import get_current_user, require_super_admin
from app.models.institution import Institution
from app.models.user import User, UserRole
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/institutions", tags=["Institutions"])


# Pydantic Schemas
class InstitutionPublicResponse(BaseModel):
    id: str
    name: str
    code: str
    logo_url: str | None = None
    brand_color: str | None = "#0070f3"
    is_active: bool

    model_config = {"from_attributes": True}


class InstitutionDetailResponse(InstitutionPublicResponse):
    created_at: str


class InstitutionCreateRequest(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=50, pattern=r"^[a-z0-9_-]+$")
    logo_url: str | None = None
    brand_color: str | None = None
    is_active: bool = True


class InstitutionUpdateRequest(BaseModel):
    name: str | None = Field(None, max_length=200)
    code: str | None = Field(None, max_length=50, pattern=r"^[a-z0-9_-]+$")
    logo_url: str | None = None
    brand_color: str | None = None
    is_active: bool | None = None


# Endpoints
@router.get("", response_model=list[InstitutionPublicResponse])
async def list_institutions(
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_session),
):
    query = select(Institution).order_by(Institution.name.asc())
    if active_only:
        query = query.where(Institution.is_active.is_(True))

    result = await db.execute(query)
    institutions = result.scalars().all()

    return [
        InstitutionPublicResponse(
            id=str(inst.id),
            name=inst.name,
            code=inst.code,
            logo_url=inst.logo_url,
            brand_color=getattr(inst, "brand_color", None) or "#0070f3",
            is_active=inst.is_active,
        )
        for inst in institutions
    ]


@router.get("/by-slug/{slug}", response_model=InstitutionPublicResponse)
async def get_institution_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_session),
):
    clean_slug = slug.strip().lower()
    result = await db.execute(
        select(Institution).where(Institution.code == clean_slug)
    )
    inst = result.scalar_one_or_none()
    if not inst:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Institution with code '{slug}' not found",
        )

    return InstitutionPublicResponse(
        id=str(inst.id),
        name=inst.name,
        code=inst.code,
        logo_url=inst.logo_url,
        brand_color=getattr(inst, "brand_color", None) or "#0070f3",
        is_active=inst.is_active,
    )


@router.get("/my-institution", response_model=InstitutionDetailResponse)
async def get_my_institution(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if not current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with an institution",
        )

    inst = await db.get(Institution, current_user.institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    return InstitutionDetailResponse(
        id=str(inst.id),
        name=inst.name,
        code=inst.code,
        logo_url=inst.logo_url,
        brand_color=getattr(inst, "brand_color", None) or "#0070f3",
        is_active=inst.is_active,
        created_at=inst.created_at.isoformat() if hasattr(inst, "created_at") and inst.created_at else datetime.now().isoformat(),
    )


@router.patch("/my-institution", response_model=InstitutionDetailResponse)
async def update_my_institution(
    body: InstitutionUpdateRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.admin, UserRole.super_admin, UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only University Administrators can update campus branding",
        )

    if not current_user.institution_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not associated with an institution",
        )

    inst = await db.get(Institution, current_user.institution_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    if body.name is not None:
        inst.name = body.name.strip()
    if body.logo_url is not None:
        inst.logo_url = body.logo_url
    if body.brand_color is not None and hasattr(inst, "brand_color"):
        inst.brand_color = body.brand_color
    if body.code is not None and current_user.role == UserRole.super_admin:
        inst.code = body.code.strip().lower()

    await db.commit()
    await db.refresh(inst)

    return InstitutionDetailResponse(
        id=str(inst.id),
        name=inst.name,
        code=inst.code,
        logo_url=inst.logo_url,
        brand_color=getattr(inst, "brand_color", None) or "#0070f3",
        is_active=inst.is_active,
        created_at=inst.created_at.isoformat() if hasattr(inst, "created_at") and inst.created_at else datetime.now().isoformat(),
    )


@router.get("/{institution_id}", response_model=InstitutionDetailResponse)
async def get_institution_by_id(
    institution_id: str,
    db: AsyncSession = Depends(get_session),
):
    try:
        uid = uuid.UUID(institution_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid institution ID format")

    inst = await db.get(Institution, uid)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    return InstitutionDetailResponse(
        id=str(inst.id),
        name=inst.name,
        code=inst.code,
        logo_url=inst.logo_url,
        brand_color=getattr(inst, "brand_color", None) or "#0070f3",
        is_active=inst.is_active,
        created_at=inst.created_at.isoformat(),
    )


@router.post("", response_model=InstitutionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    body: InstitutionCreateRequest,
    db: AsyncSession = Depends(get_session),
    _: User = Depends(require_super_admin),
):
    clean_code = body.code.strip().lower()
    existing = await db.execute(
        select(Institution).where(Institution.code == clean_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Institution with code '{clean_code}' already exists",
        )

    inst = Institution(
        name=body.name.strip(),
        code=clean_code,
        logo_url=body.logo_url,
        is_active=body.is_active,
    )
    db.add(inst)
    await db.commit()
    await db.refresh(inst)

    return InstitutionDetailResponse(
        id=str(inst.id),
        name=inst.name,
        code=inst.code,
        logo_url=inst.logo_url,
        is_active=inst.is_active,
        created_at=inst.created_at.isoformat(),
    )
