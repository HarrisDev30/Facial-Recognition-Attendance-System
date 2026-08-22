import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.services import notification_service

db_url = "postgresql+asyncpg://neondb_owner:npg_LQrYT9R7PXyG@ep-solitary-wave-az4j3s6q-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?ssl=require"

async def main():
    engine = create_async_engine(
        db_url,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        res = await session.execute(select(User).where(User.email == "admin@gmail.com"))
        user = res.scalar_one_or_none()
        if user:
            items, unread = await notification_service.get_user_notifications(session, user.id)
            print(f"User {user.email} has {len(items)} notifications ({unread} unread):")
            for item in items:
                print(f" - [{item.notification_type}] {item.title}: {item.message} (Read: {item.is_read})")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
