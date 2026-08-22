import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.user import User
from app.services import notification_service
from app.models.notification import NotificationType

db_url = "postgresql+asyncpg://neondb_owner:npg_LQrYT9R7PXyG@ep-solitary-wave-az4j3s6q-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?ssl=require"

async def main():
    engine = create_async_engine(
        db_url,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Find first user
        res = await session.execute(select(User).limit(1))
        user = res.scalar_one_or_none()
        if not user:
            print("No user found!")
            return
        
        print(f"Testing notification for user: {user.email} (ID: {user.id})")
        try:
            notif = await notification_service.create_notification(
                session=session,
                user_id=user.id,
                title="Test Notification",
                message="Testing notification system functionality.",
                notification_type=NotificationType.cohost_invite,
                link_url="/admin/events",
            )
            await session.commit()
            print(f"SUCCESS! Notification created with ID: {notif.id}")
        except Exception as e:
            print(f"ERROR creating notification: {e}")
            import traceback
            traceback.print_exc()

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
