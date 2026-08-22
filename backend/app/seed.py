import asyncio
import uuid

from app.database import async_session_factory
from app.models.attendee import Attendee, AttendeeType
from app.models.institution import Institution
from app.models.membership import MemberType, Membership
from app.models.organization import OrgType, Organization
from app.models.organization_staff import OrgRole, OrganizationStaff
from app.models.user import User, UserRole
from app.utils.security import hash_password
from sqlalchemy import select


async def seed() -> None:
    async with async_session_factory() as session:
        # 1. Seed Primary Institution: Cor Jesu College (cjc)
        cjc_inst = (
            await session.execute(select(Institution).where(Institution.code == "cjc"))
        ).scalar_one_or_none()

        if cjc_inst is None:
            cjc_inst = Institution(
                name="Cor Jesu College",
                code="cjc",
                logo_url="https://images.unsplash.com/photo-1562774053-701939374585?w=200",
                is_active=True,
            )
            session.add(cjc_inst)
            await session.flush()
            print(f"Created Primary Institution: {cjc_inst.name} ({cjc_inst.code})")

        # Seed Secondary Institution for Multi-Tenant verification: Ateneo de Davao University (addu)
        addu_inst = (
            await session.execute(select(Institution).where(Institution.code == "addu"))
        ).scalar_one_or_none()

        if addu_inst is None:
            addu_inst = Institution(
                name="Ateneo de Davao University",
                code="addu",
                logo_url="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=200",
                is_active=True,
            )
            session.add(addu_inst)
            await session.flush()
            print(f"Created Secondary Institution: {addu_inst.name} ({addu_inst.code})")

        # 2. Seed Super-Admin User
        super_admin = (
            await session.execute(select(User).where(User.email == "superadmin@attendify.edu"))
        ).scalar_one_or_none()

        if super_admin is None:
            super_admin = User(
                email="superadmin@attendify.edu",
                password_hash=hash_password("superadmin123!"),
                role=UserRole.super_admin,
                first_name="Platform",
                last_name="SuperAdmin",
                institution_id=None,
            )
            session.add(super_admin)
            await session.flush()
            print(f"Created Super-Admin user: id={super_admin.id}")

        # 3. Seed University Admin and Marshal for Cor Jesu College
        admin = (
            await session.execute(select(User).where(User.email == "admin@gmail.com"))
        ).scalar_one_or_none()

        if admin is None:
            admin = User(
                email="admin@gmail.com",
                password_hash=hash_password("admin123!"),
                role=UserRole.admin,
                first_name="CJC",
                last_name="Administrator",
                institution_id=cjc_inst.id,
            )
            session.add(admin)
            await session.flush()
            print(f"Created CJC admin user: id={admin.id}")
        else:
            admin.institution_id = cjc_inst.id

        marshal = (
            await session.execute(select(User).where(User.email == "marshal@gmail.com"))
        ).scalar_one_or_none()

        if marshal is None:
            marshal = User(
                email="marshal@gmail.com",
                password_hash=hash_password("marshal123!"),
                role=UserRole.marshal,
                first_name="CJC Event",
                last_name="Marshal",
                institution_id=cjc_inst.id,
            )
            session.add(marshal)
            await session.flush()
            print(f"Created CJC marshal user: id={marshal.id}")
        else:
            marshal.institution_id = cjc_inst.id

        # 4. Seed Default Colleges & Student Clubs under Cor Jesu College
        colleges_and_clubs = [
            {"name": "College of Computing and Information Sciences", "code": "CCIS", "type": OrgType.COLLEGE, "desc": "Department of Computer Science & IT"},
            {"name": "College of Engineering", "code": "COE", "type": OrgType.COLLEGE, "desc": "Department of Engineering"},
            {"name": "College of Education, Arts and Sciences", "code": "CEDAS", "type": OrgType.COLLEGE, "desc": "Department of Education & Humanities"},
            {"name": "College of Health Sciences", "code": "CHS", "type": OrgType.COLLEGE, "desc": "Department of Nursing & Allied Health"},
            {"name": "College of Accountancy, Business and Entrepreneurship", "code": "CABE", "type": OrgType.COLLEGE, "desc": "Department of Business & Accountancy"},
            {"name": "Math Club", "code": "MATHCLUB", "type": OrgType.CLUB, "desc": "University Mathematics & Analytics Society"},
            {"name": "Chess Club", "code": "CHESSCLUB", "type": OrgType.CLUB, "desc": "University Competitive Chess Organization"},
            {"name": "Robotics Society", "code": "ROBOTICS", "type": OrgType.CLUB, "desc": "Autonomous Robotics & Automation Club"},
        ]

        org_map = {}
        for item in colleges_and_clubs:
            existing = (
                await session.execute(
                    select(Organization).where(
                        Organization.code == item["code"],
                        Organization.institution_id == cjc_inst.id,
                    )
                )
            ).scalar_one_or_none()
            if existing is None:
                org = Organization(
                    institution_id=cjc_inst.id,
                    name=item["name"],
                    code=item["code"],
                    org_type=item["type"],
                    description=item["desc"],
                )
                session.add(org)
                await session.flush()
                org_map[item["code"]] = org
                print(f"Created CJC Organization: {org.name} ({org.code})")
            else:
                org_map[item["code"]] = existing

        # 5. Seed Sample Faculty & Student Attendees for CJC
        ccis_org = org_map.get("CCIS")
        math_club = org_map.get("MATHCLUB")

        if ccis_org and math_club:
            fac_prof = (
                await session.execute(
                    select(Attendee).where(
                        Attendee.identifier == "FAC-2026-001",
                        Attendee.institution_id == cjc_inst.id,
                    )
                )
            ).scalar_one_or_none()
            if fac_prof is None:
                fac_prof = Attendee(
                    institution_id=cjc_inst.id,
                    identifier="FAC-2026-001",
                    first_name="Dr. Alan",
                    last_name="Turing",
                    email="prof.turing@cjc.edu.ph",
                    attendee_type=AttendeeType.faculty,
                    organization_id=ccis_org.id,
                )
                session.add(fac_prof)
                await session.flush()
                print("Created CJC Faculty member: Dr. Alan Turing")

                session.add(Membership(
                    organization_id=math_club.id,
                    attendee_id=fac_prof.id,
                    member_type=MemberType.FACULTY,
                    role="Faculty Advisor",
                ))

            stud_john = (
                await session.execute(
                    select(Attendee).where(
                        Attendee.identifier == "STUD-2026-001",
                        Attendee.institution_id == cjc_inst.id,
                    )
                )
            ).scalar_one_or_none()
            if stud_john is None:
                stud_john = Attendee(
                    institution_id=cjc_inst.id,
                    identifier="STUD-2026-001",
                    first_name="John",
                    last_name="Doe",
                    email="john.doe@cjc.edu.ph",
                    attendee_type=AttendeeType.student,
                    organization_id=ccis_org.id,
                )
                session.add(stud_john)
                await session.flush()
                print("Created CJC Student member: John Doe")

                session.add(Membership(
                    organization_id=math_club.id,
                    attendee_id=stud_john.id,
                    member_type=MemberType.STUDENT,
                    role="Active Member",
                ))

        # 6. Seed Sample Organization & Student for AdDU (Proving Composite Uniqueness with SAME ID "STUD-2026-001")
        addu_cs = (
            await session.execute(
                select(Organization).where(
                    Organization.code == "CS_DEPT",
                    Organization.institution_id == addu_inst.id,
                )
            )
        ).scalar_one_or_none()

        if addu_cs is None:
            addu_cs = Organization(
                institution_id=addu_inst.id,
                name="Computer Science Department",
                code="CS_DEPT",
                org_type=OrgType.COLLEGE,
                description="AdDU CS Dept",
            )
            session.add(addu_cs)
            await session.flush()

            # Seed student with identical identifier "STUD-2026-001" under AdDU
            addu_student = Attendee(
                institution_id=addu_inst.id,
                identifier="STUD-2026-001",
                first_name="Maria",
                last_name="Santos",
                email="maria.santos@addu.edu.ph",
                attendee_type=AttendeeType.student,
                organization_id=addu_cs.id,
            )
            session.add(addu_student)
            await session.flush()
            print(f"Created AdDU Student with duplicate ID format: {addu_student.identifier} ({addu_student.first_name})")

        await session.commit()
        print("Database seeding completed successfully with multi-tenant institutions.")


if __name__ == "__main__":
    asyncio.run(seed())
