import asyncio
import uuid

from app.database import async_session_factory
from app.models.attendee import Attendee, AttendeeType
from app.models.membership import MemberType, Membership
from app.models.organization import OrgType, Organization
from app.models.organization_staff import OrgRole, OrganizationStaff
from app.models.user import User, UserRole
from app.utils.security import hash_password
from sqlalchemy import select


async def seed() -> None:
    async with async_session_factory() as session:
        # 1. Users (Admin, Marshal)
        admin = (
            await session.execute(select(User).where(User.email == "admin@gmail.com"))
        ).scalar_one_or_none()

        if admin is None:
            admin = User(
                email="admin@gmail.com",
                password_hash=hash_password("admin123!"),
                role=UserRole.admin,
                first_name="System",
                last_name="Administrator",
            )
            session.add(admin)
            await session.flush()
            print(f"Created admin user: id={admin.id}")

        marshal = (
            await session.execute(select(User).where(User.email == "marshal@gmail.com"))
        ).scalar_one_or_none()

        if marshal is None:
            marshal = User(
                email="marshal@gmail.com",
                password_hash=hash_password("marshal123!"),
                role=UserRole.marshal,
                first_name="Event",
                last_name="Marshal",
            )
            session.add(marshal)
            await session.flush()
            print(f"Created marshal user: id={marshal.id}")

        # 2. Seed Default Colleges & Student Clubs
        colleges_and_clubs = [
            # Colleges
            {"name": "College of Computer Studies", "code": "CCIS", "type": OrgType.COLLEGE, "desc": "Department of Computer Science & IT"},
            {"name": "College of Engineering & Architecture", "code": "COE", "type": OrgType.COLLEGE, "desc": "Department of Engineering"},
            {"name": "College of Education & Arts", "code": "CEDAS", "type": OrgType.COLLEGE, "desc": "Department of Education & Humanities"},
            {"name": "College of Health Sciences", "code": "CHS", "type": OrgType.COLLEGE, "desc": "Department of Nursing & Allied Health"},
            {"name": "College of Business", "code": "CABE", "type": OrgType.COLLEGE, "desc": "Department of Business & Accountancy"},
            # Dynamic Clubs
            {"name": "Math Club", "code": "MATHCLUB", "type": OrgType.CLUB, "desc": "University Mathematics & Analytics Society"},
            {"name": "Chess Club", "code": "CHESSCLUB", "type": OrgType.CLUB, "desc": "University Competitive Chess Organization"},
            {"name": "Robotics Society", "code": "ROBOTICS", "type": OrgType.CLUB, "desc": "Autonomous Robotics & Automation Club"},
        ]

        org_map = {}
        for item in colleges_and_clubs:
            existing = (
                await session.execute(select(Organization).where(Organization.code == item["code"]))
            ).scalar_one_or_none()
            if existing is None:
                org = Organization(
                    name=item["name"],
                    code=item["code"],
                    org_type=item["type"],
                    description=item["desc"],
                )
                session.add(org)
                await session.flush()
                org_map[item["code"]] = org
                print(f"Created Organization: {org.name} ({org.code})")
            else:
                org_map[item["code"]] = existing

        # 3. Seed Sample Faculty & Student Attendees
        ccis_org = org_map.get("CCIS")
        math_club = org_map.get("MATHCLUB")

        if ccis_org and math_club:
            # Faculty
            fac_prof = (
                await session.execute(select(Attendee).where(Attendee.identifier == "FAC-2026-001"))
            ).scalar_one_or_none()
            if fac_prof is None:
                fac_prof = Attendee(
                    identifier="FAC-2026-001",
                    first_name="Dr. Alan",
                    last_name="Turing",
                    email="prof.turing@university.edu",
                    attendee_type=AttendeeType.faculty,
                    organization_id=ccis_org.id,
                )
                session.add(fac_prof)
                await session.flush()
                print("Created Faculty member: Dr. Alan Turing")

                # Faculty membership in Math Club as Advisor
                session.add(Membership(
                    organization_id=math_club.id,
                    attendee_id=fac_prof.id,
                    member_type=MemberType.FACULTY,
                    role="Faculty Advisor",
                ))

            # Student
            stud_john = (
                await session.execute(select(Attendee).where(Attendee.identifier == "STUD-2026-001"))
            ).scalar_one_or_none()
            if stud_john is None:
                stud_john = Attendee(
                    identifier="STUD-2026-001",
                    first_name="John",
                    last_name="Doe",
                    email="john.doe@student.university.edu",
                    attendee_type=AttendeeType.student,
                    organization_id=ccis_org.id,
                )
                session.add(stud_john)
                await session.flush()
                print("Created Student member: John Doe")

                # Student membership in Math Club
                session.add(Membership(
                    organization_id=math_club.id,
                    attendee_id=stud_john.id,
                    member_type=MemberType.STUDENT,
                    role="Active Member",
                ))

        await session.commit()
        print("Database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
