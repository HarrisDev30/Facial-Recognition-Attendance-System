import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

db_url = "postgresql+asyncpg://neondb_owner:npg_LQrYT9R7PXyG@ep-solitary-wave-az4j3s6q-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?ssl=require"

async def main():
    engine = create_async_engine(
        db_url,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                notification_type VARCHAR(50) NOT NULL DEFAULT 'system_announcement',
                is_read BOOLEAN NOT NULL DEFAULT FALSE,
                link_url VARCHAR(500),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications(is_read);"))
        print("Successfully created notifications table on Neon DB!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
