import uuid
import pytest
from app.models.institution import Institution
from app.models.organization import Organization, OrgType
from app.models.attendee import Attendee
from app.models.user import UserRole
from app.services.auth_service import create_access_token, decode_token
from sqlalchemy.exc import IntegrityError


@pytest.mark.asyncio
async def test_multi_tenant_composite_uniqueness(test_session):
    """Verify that multiple institutions can have identical student IDs, but duplicates within the same institution fail."""
    # Create Institution A and Institution B
    inst_a = Institution(name="University Alpha", code=f"alpha_{uuid.uuid4().hex[:6]}")
    inst_b = Institution(name="University Beta", code=f"beta_{uuid.uuid4().hex[:6]}")
    test_session.add_all([inst_a, inst_b])
    await test_session.flush()

    # Create Organizations for both
    org_a = Organization(institution_id=inst_a.id, name="CS Dept Alpha", code="CS_A", org_type=OrgType.COLLEGE)
    org_b = Organization(institution_id=inst_b.id, name="CS Dept Beta", code="CS_B", org_type=OrgType.COLLEGE)
    test_session.add_all([org_a, org_b])
    await test_session.flush()

    # Insert student with ID 'STUD-999' in Institution A
    student_a = Attendee(
        institution_id=inst_a.id,
        organization_id=org_a.id,
        identifier="STUD-999",
        first_name="Alice",
        last_name="Smith",
    )
    test_session.add(student_a)
    await test_session.flush()

    # Insert student with IDENTICAL ID 'STUD-999' in Institution B (MUST SUCCEED)
    student_b = Attendee(
        institution_id=inst_b.id,
        organization_id=org_b.id,
        identifier="STUD-999",
        first_name="Bob",
        last_name="Jones",
    )
    test_session.add(student_b)
    await test_session.flush()

    assert student_a.id != student_b.id
    assert student_a.identifier == student_b.identifier
    assert student_a.institution_id != student_b.institution_id

    # Insert duplicate student 'STUD-999' within Institution A again (MUST FAIL with IntegrityError)
    student_a_duplicate = Attendee(
        institution_id=inst_a.id,
        organization_id=org_a.id,
        identifier="STUD-999",
        first_name="Charlie",
        last_name="Brown",
    )
    test_session.add(student_a_duplicate)
    with pytest.raises(IntegrityError):
        await test_session.flush()

    await test_session.rollback()


@pytest.mark.asyncio
async def test_jwt_claims_with_institution():
    """Verify that JWT tokens correctly carry institution_id and super_admin role."""
    inst_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    # 1. Super Admin Token (No Institution)
    super_admin_payload = {
        "sub": user_id,
        "email": "superadmin@attendify.edu",
        "role": UserRole.super_admin.value,
        "institution_id": None,
        "institution_code": None,
    }
    token = create_access_token(super_admin_payload)
    decoded = decode_token(token)

    assert decoded["sub"] == user_id
    assert decoded["role"] == "super_admin"
    assert decoded["institution_id"] is None

    # 2. University Admin Token (Scoped to Institution)
    admin_payload = {
        "sub": user_id,
        "email": "admin@cjc.edu.ph",
        "role": UserRole.admin.value,
        "institution_id": inst_id,
        "institution_code": "cjc",
    }
    admin_token = create_access_token(admin_payload)
    decoded_admin = decode_token(admin_token)

    assert decoded_admin["sub"] == user_id
    assert decoded_admin["role"] == "admin"
    assert decoded_admin["institution_id"] == inst_id
    assert decoded_admin["institution_code"] == "cjc"
