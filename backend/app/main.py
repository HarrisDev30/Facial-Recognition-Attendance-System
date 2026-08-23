import asyncio
from contextlib import asynccontextmanager

from app.api import (
    attendance,
    attendees,
    auth,
    departments,
    devices,
    events,
    institutions,
    marshal,
    notifications,
    organizations,
    privacy,
    registration,
    reports,
    scanner,
    sessions,
    super_admin,
)
from app.config import settings
from app.database import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    os.makedirs(settings.profile_photo_dir, exist_ok=True)
    os.makedirs(settings.event_photo_dir, exist_ok=True)

    from app.services.face_recognition import ensure_model_loaded
    print("Loading face recognition model...")
    await ensure_model_loaded()
    print("Face recognition model ready.")

    from app.database import get_session_ctx
    from app.models.institution import Institution
    from app.services.faiss_index import ensure_institution_index_loaded

    print("Pre-warming FAISS vector indices for active institutions...")
    try:
        async with get_session_ctx() as session:
            result = await session.execute(
                select(Institution).where(Institution.is_active.is_(True))
            )
            active_institutions = result.scalars().all()
            for inst in active_institutions:
                await ensure_institution_index_loaded(session, inst.id, force=True)
        print(f"FAISS vector indices ready for {len(active_institutions)} active institutions.")
    except Exception as e:
        print(f"Warning: Could not pre-warm FAISS indices: {e}. Will load on-demand.")

    task = asyncio.create_task(_rebuild_faiss_index_periodically())
    auto_close_task = asyncio.create_task(_auto_close_sessions_periodically())
    yield
    task.cancel()
    auto_close_task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
    try:
        await auto_close_task
    except asyncio.CancelledError:
        pass

    from app.services.face_recognition import shutdown_executor
    shutdown_executor()

    await engine.dispose()


async def _rebuild_faiss_index_periodically():
    from app.database import get_session_ctx
    from app.models.institution import Institution
    from app.services.faiss_index import (
        ensure_institution_index_loaded,
        evict_idle_indices,
    )
    from sqlalchemy import select

    while True:
        await asyncio.sleep(settings.faiss_index_rebuild_interval)
        try:
            # 1. Evict indices that have been idle past 1 hour
            evicted = evict_idle_indices(max_idle_seconds=3600)
            if evicted > 0:
                print(f"FAISS index eviction: released {evicted} idle institution indices.")

            # 2. Refresh active institutions
            async with get_session_ctx() as session:
                result = await session.execute(
                    select(Institution).where(Institution.is_active.is_(True))
                )
                active_institutions = result.scalars().all()
                for inst in active_institutions:
                    await ensure_institution_index_loaded(session, inst.id, force=False)
        except Exception:
            pass


async def _auto_close_sessions_periodically():
    from app.database import get_session_ctx
    from app.services.event_service import auto_close_expired_sessions

    while True:
        await asyncio.sleep(30)  # Reconcile expired sessions every 30 seconds
        try:
            async with get_session_ctx() as session:
                closed = await auto_close_expired_sessions(session)
                if closed:
                    print(f"Auto-closed {len(closed)} expired attendance sessions.")
        except Exception:
            pass


app = FastAPI(
    title="Attendify Multi-Institution API",
    description="Enterprise Multi-Institution Biometric Attendance Platform",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



app.include_router(institutions.router)
app.include_router(auth.router)
app.include_router(events.router)
app.include_router(sessions.router)
app.include_router(registration.router)
app.include_router(scanner.router)
app.include_router(attendance.router)
app.include_router(reports.router)
app.include_router(attendees.router)
app.include_router(departments.router)
app.include_router(organizations.router)
app.include_router(devices.router)
app.include_router(marshal.router)
app.include_router(privacy.router)
app.include_router(notifications.router)
app.include_router(super_admin.router)


@app.get("/")
async def root():
    return {"status": "ok", "app": "Attendify", "version": "2.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "attendify-api"}
