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
        res = await conn.execute(text("UPDATE events SET target_scope = 'department_only' WHERE target_scope IS NULL OR target_scope = 'all' OR target_scope = '';"))
        print(f"Successfully updated legacy events to department_only target_scope! ({res.rowcount} events updated)")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
