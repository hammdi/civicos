"""CivicOS — a single FastAPI application hosting four civic modules.

    Module 1  Digital Queue System      (الطابور الرقمي)
    Module 2  Document Tracker          (تتبع الوثائق)
    Module 3  Local Market              (السوق المحلي)
    Module 4  Urban Issue Reporter      (بلاغ مشكل)

Shared infrastructure: phone-OTP citizen auth, JWT admin auth, console/Twilio
notifications and a WebSocket fan-out for live updates.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import __version__
from app.core.config import settings
from app.core.database import engine
from app.routers import (
    auth,
    documents,
    documents_admin,
    identity,
    issues,
    issues_admin,
    market,
    me,
    payments,
    queue,
    queue_admin,
)
from app.schemas.common import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("civicos")

MODULES = [
    "queue",
    "documents",
    "market",
    "issues",
]

app = FastAPI(
    title="CivicOS API",
    version=__version__,
    description=(
        "Open-source civic platform digitalising essential daily citizen "
        "services. Designed to work for ANY city or country."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root():
    return {
        "app": settings.app_name,
        "version": __version__,
        "tagline": "No more physical queues. No more lost documents. No more unanswered complaints.",
        "modules": MODULES,
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health():
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001
        db_ok = False
        logger.warning("Health check DB error: %s", exc)
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        app=settings.app_name,
        version=__version__,
        modules=MODULES,
    )


# --- Shared auth & accounts -------------------------------------------------
app.include_router(auth.router)          # /auth/register, /auth/verify-otp, /auth/me
app.include_router(auth.admin_router)    # /admin/login
app.include_router(me.router)            # /me/overview (personal dashboard)

# --- Ecosystem integrations -------------------------------------------------
app.include_router(identity.router)      # /identity/* — StateSync verification
app.include_router(payments.router)      # /payments/* — IslamicFinanceOS settlement

# --- Module 1: Queue --------------------------------------------------------
app.include_router(queue.router)         # /institutions, /tickets, /ws/queue/...
app.include_router(queue_admin.router)   # /admin/queue/*, /admin/dashboard, /admin/stats

# --- Module 2: Documents ----------------------------------------------------
app.include_router(documents.router)         # /files, /document-types, /ws/files/...
app.include_router(documents_admin.router)   # /admin/files, /admin/files/{id}/...

# --- Module 3: Market -------------------------------------------------------
app.include_router(market.router)        # /listings, /sellers/...

# --- Module 4: Issues -------------------------------------------------------
app.include_router(issues.router)        # /issues, /issue-categories
app.include_router(issues_admin.router)  # /admin/issues/*


@app.on_event("startup")
async def on_startup() -> None:
    import asyncio

    from app.core.websocket import manager

    # Capture the running loop so sync handlers can schedule WS broadcasts.
    manager.bind_loop(asyncio.get_running_loop())
    logger.info("CivicOS %s starting — modules: %s", __version__, ", ".join(MODULES))
