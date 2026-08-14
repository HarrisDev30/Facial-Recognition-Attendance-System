import asyncio
from app.database import engine, Base
import app.models  # Ensure all models are registered with Base
from app.seed import seed


async def main():
    print("Recreating database tables for dynamic multi-organization schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully. Running database seed...")
    await seed()
    print("Database initialization complete!")


if __name__ == "__main__":
    asyncio.run(main())
