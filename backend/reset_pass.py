import asyncio
from app.database import async_session_factory
from app.models.user import User, UserRole
from app.utils.security import hash_password
from sqlalchemy import select

async def main():
    async with async_session_factory() as session:
        res = await session.execute(select(User).where(User.email == "harrisasani@g.cjc.edu.ph"))
        u = res.scalar_one_or_none()
        if u:
            u.password_hash = hash_password("Password123!")
            u.role = UserRole.org_admin
            await session.commit()
            print("Successfully updated harrisasani@g.cjc.edu.ph password to Password123! and role to org_admin")

if __name__ == "__main__":
    asyncio.run(main())
