"""StateSync integration — the national e-government identity backbone.

CivicOS uses StateSync to (a) verify a citizen's national ID (CIN) and pull the
official record, and (b) verify that a document reference is authentic.

Everything degrades gracefully: if StateSync is unreachable or disabled, the
calls return a structured "unavailable" result instead of raising, so CivicOS
keeps working as a standalone platform.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger("civicos.statesync")


@dataclass
class IdentityResult:
    ok: bool
    available: bool  # was StateSync reachable?
    cin: str | None = None
    full_name: str | None = None
    birth_date: str | None = None
    phone: str | None = None
    message: str = ""


def _client() -> httpx.Client:
    return httpx.Client(base_url=settings.statesync_base_url, timeout=settings.ecosystem_timeout_seconds)


def get_citizen(cin: str) -> IdentityResult:
    """Look up an official citizen record by national ID (CIN)."""
    if not settings.statesync_enabled:
        return IdentityResult(ok=False, available=False, message="StateSync disabled")
    try:
        with _client() as client:
            resp = client.get(f"/citizen/{cin}")
        if resp.status_code == 404:
            return IdentityResult(ok=False, available=True, message="No citizen with that national ID")
        resp.raise_for_status()
        data = resp.json()
        return IdentityResult(
            ok=True,
            available=True,
            cin=str(data.get("cin", cin)),
            full_name=data.get("full_name"),
            birth_date=data.get("birth_date"),
            phone=data.get("phone"),
            message="Identity confirmed by StateSync",
        )
    except httpx.HTTPError as exc:
        logger.warning("StateSync unreachable: %s", exc)
        return IdentityResult(ok=False, available=False, message="StateSync is temporarily unavailable")


def verify_document(reference: str) -> dict:
    """Verify a StateSync-issued document reference is authentic."""
    if not settings.statesync_enabled:
        return {"valid": False, "available": False, "message": "StateSync disabled"}
    try:
        with _client() as client:
            resp = client.get(f"/public/verify/{reference}")
        resp.raise_for_status()
        data = resp.json()
        data["available"] = True
        return data
    except httpx.HTTPError as exc:
        logger.warning("StateSync verify unreachable: %s", exc)
        return {"valid": False, "available": False, "message": "StateSync is temporarily unavailable"}
