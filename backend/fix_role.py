import asyncio
from app.database import async_session_factory
from app.models.user import User, UserRole
from sqlalchemy import select, update

async def main():
    async with async_session_factory() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"User: {u.email}, Current Role: {u.role}")
            if u.email == "harrisasani@g.cjc.edu.ph":
                u.role = UserRole.org_admin
                print(f"--> Updated {u.email} role to org_admin!")
        await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
