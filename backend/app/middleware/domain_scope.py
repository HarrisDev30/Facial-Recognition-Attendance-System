import uuid
from typing import Any

from app.database import get_session
from app.middleware.auth import get_current_user
from app.models.attendance_session import AttendanceSession
from app.models.event import Event
from app.models.organization import Organization
from app.models.organization_staff import OrganizationStaff, OrgRole
from app.models.user import User, UserRole
from fastapi import Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select


class DomainScope:
    """Deep domain policy module enforcing multi-tenant and department-level isolation

    at the data access seam.
    """

    def __init__(
        self,
        user: User,
        institution_id: uuid.UUID | None,
        assigned_org_ids: list[uuid.UUID] | None = None,
    ):
        self.user = user
        self.institution_id = institution_id
        self.assigned_org_ids = assigned_org_ids or []

    @property
    def is_super_admin(self) -> bool:
        return self.user.role in (UserRole.super_admin, UserRole.SUPER_ADMIN)

    @property
    def is_institution_admin(self) -> bool:
        return self.user.role in (UserRole.admin, UserRole.ADMIN)

    @property
    def is_org_admin(self) -> bool:
        return self.user.role in (UserRole.org_admin, UserRole.ORG_ADMIN)

    @property
    def is_marshal(self) -> bool:
        return (
            self.user.role in (UserRole.marshal, UserRole.MARSHAL)
            or (self.user.role in (UserRole.student, UserRole.STUDENT) and len(self.assigned_org_ids) > 0)
        )

    @property
    def is_admin_or_higher(self) -> bool:
        return self.is_super_admin or self.is_institution_admin or self.is_org_admin

    def get_accessible_org_ids(self) -> list[uuid.UUID] | None:
        """Returns None if actor has campus-wide access (unrestricted within institution),

        or a list of specific assigned organization UUIDs.
        """
        if self.is_super_admin or self.is_institution_admin:
            return None
        return list(self.assigned_org_ids)

    def scope_query(self, query: Select, model_class: Any) -> Select:
        """Injects institution and organization scoping WHERE clauses into a SQLAlchemy query."""
        # 1. Super admin bypasses all data constraints
        if self.is_super_admin:
            return query

        # 2. Enforce Institution isolation
        if self.institution_id and hasattr(model_class, "institution_id"):
            query = query.where(model_class.institution_id == self.institution_id)

        # 3. Enforce Department / Organization scoping for org_admin and marshal
        if (self.is_org_admin or self.is_marshal) and hasattr(model_class, "organization_id"):
            if not self.assigned_org_ids:
                # User has no assigned organizations -> empty result set
                query = query.where(model_class.organization_id == None)  # noqa: E711
            else:
                # Handle Event models with optional co-hosts
                if model_class is Event or hasattr(model_class, "co_host_dept_ids"):
                    # Check primary organization_id or co-hosting match
                    query = query.where(
                        or_(
                            model_class.organization_id.in_(self.assigned_org_ids),
                            model_class.organization_id == None,  # System-wide events in institution
                        )
                    )
                else:
                    query = query.where(model_class.organization_id.in_(self.assigned_org_ids))

        return query

    def assert_can_manage_org(self, org_id: uuid.UUID | str) -> None:
        """Asserts that the caller is authorized to perform administrative actions on an organization."""
        if self.is_super_admin or self.is_institution_admin:
            return

        if not self.is_org_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization management requires administrative privileges",
            )

        target_uuid = uuid.UUID(str(org_id))
        if target_uuid not in self.assigned_org_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to manage this department or organization",
            )

    async def assert_can_operate_session(
        self,
        session_id: uuid.UUID | str,
        db: AsyncSession,
    ) -> AttendanceSession:
        """Asserts that the caller (Admin or Marshal) is authorized to operate scanning

        and attendance overrides for the specified session. Returns the AttendanceSession.
        """
        sess_uuid = uuid.UUID(str(session_id))
        res = await db.execute(
            select(AttendanceSession, Event)
            .join(Event, AttendanceSession.event_id == Event.id)
            .where(AttendanceSession.id == sess_uuid)
        )
        row = res.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Attendance session not found",
            )

        session_obj, event_obj = row

        # Check tenant isolation
        if not self.is_super_admin and self.institution_id:
            if event_obj.institution_id != self.institution_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to operate session for another institution",
                )

        # Super admin and Institution Admin have full operational authority
        if self.is_super_admin or self.is_institution_admin:
            return session_obj

        # Org Admin and Marshal check department assignment or co-hosting
        if self.is_org_admin or self.is_marshal:
            event_org_id = event_obj.organization_id
            co_host_ids = event_obj.co_host_dept_ids or []
            co_host_uuids = [
                uuid.UUID(str(cid)) if not isinstance(cid, uuid.UUID) else cid
                for cid in co_host_ids
            ]

            is_primary_host = event_org_id in self.assigned_org_ids if event_org_id else True
            is_co_host = any(assigned in co_host_uuids for assigned in self.assigned_org_ids)

            if is_primary_host or is_co_host:
                return session_obj

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to operate scanner for this department event session",
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Scanner operations require marshal or admin privileges",
        )


async def get_domain_scope(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
) -> DomainScope:
    """FastAPI dependency resolving the authenticated actor's tenant and organizational scope."""
    assigned_org_ids: list[uuid.UUID] = []

    # Fetch assigned organization IDs for scoped roles or appointed student marshals
    staff_res = await db.execute(
        select(OrganizationStaff.organization_id, OrganizationStaff.org_role).where(
            OrganizationStaff.user_id == user.id
        )
    )
    staff_entries = staff_res.all()
    direct_org_ids = [e[0] for e in staff_entries if e[1] in (OrgRole.MARSHAL, OrgRole.ADMIN)]

    if direct_org_ids:
        assigned_org_ids = list(direct_org_ids)
        # If org_admin, also resolve all child sub-units (clubs and offices) under the assigned colleges
        if user.role in (UserRole.org_admin, UserRole.ORG_ADMIN):
            child_res = await db.execute(
                select(Organization.id).where(
                    Organization.parent_id.in_(direct_org_ids)
                )
            )
            child_ids = list(child_res.scalars().all())
            assigned_org_ids.extend([cid for cid in child_ids if cid not in assigned_org_ids])

    return DomainScope(
        user=user,
        institution_id=user.institution_id,
        assigned_org_ids=assigned_org_ids,
    )
