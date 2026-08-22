import pytest_asyncio
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.config import settings
from app.database import Base, get_session, connect_args
from app.main import app


@pytest_asyncio.fixture
async def test_session():
    test_engine = create_async_engine(settings.database_url, poolclass=NullPool, connect_args=connect_args)
    async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def _get_test_session():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_session] = _get_test_session

    async with async_session() as session:
        yield session

    app.dependency_overrides.clear()
    await test_engine.dispose()
