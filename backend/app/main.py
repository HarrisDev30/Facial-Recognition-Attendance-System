import asyncio
from contextlib import asynccontextmanager

from app.api import (
    attendance,
    attendees,
    auth,
    departments,
    devices,
    events,
    marshal,
    organizations,
    privacy,
    registration,
    reports,
    scanner,
    sessions,
)
from app.config import settings
from app.database import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.base import BaseHTTPMiddleware


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
    from app.models.embedding import Embedding
    from app.services.faiss_index import build_index
    from sqlalchemy import select

    print("Building initial FAISS index...")
    try:
        async with get_session_ctx() as session:
            result = await session.execute(
                select(
                    Embedding.embedding,
                    Embedding.attendee_id,
                    Embedding.id,
                )
            )
            rows = list(result.all())
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, build_index, rows, True)
        print(f"FAISS index ready ({len(rows)} embeddings).")
    except Exception:
        print("Warning: Could not build initial FAISS index. Will retry on next cycle.")

    task = asyncio.create_task(_rebuild_faiss_index_periodically())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    from app.services.face_recognition import shutdown_executor
    shutdown_executor()

    await engine.dispose()


async def _rebuild_faiss_index_periodically():
    from app.database import get_session_ctx
    from app.models.embedding import Embedding
    from app.services.faiss_index import build_index
    from sqlalchemy import select

    while True:
        await asyncio.sleep(settings.faiss_index_rebuild_interval)
        try:
            async with get_session_ctx() as session:
                result = await session.execute(
                    select(
                        Embedding.embedding,
                        Embedding.attendee_id,
                        Embedding.id,
                    )
                )
                rows = list(result.all())
                loop = asyncio.get_running_loop()
                rebuilt = await loop.run_in_executor(None, build_index, rows)
            if rebuilt:
                print(f"FAISS index rebuilt ({len(rows)} embeddings).")
        except Exception:
            pass


app = FastAPI(
    title="Attendance Monitoring API",
    description=(
        "Portable Facial Recognition-Based Attendance Monitoring System"
        " for Institutional Events & Organizations"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(self *), microphone=()",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        for key, value in SECURITY_HEADERS.items():
            response.headers[key] = value
        return response


app.add_middleware(SecurityHeadersMiddleware)

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


@app.get("/")
async def root():
    return {"status": "ok", "message": "Attendance Monitoring System API is running"}


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "attendance-api"}
