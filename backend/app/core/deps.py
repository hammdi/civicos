"""Reusable FastAPI dependencies: DB session and auth guards."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def _decode_or_401(creds: HTTPAuthorizationCredentials | None) -> dict:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    payload = decode_access_token(creds.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return payload


def get_current_citizen(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict:
    """Returns the JWT payload for an authenticated citizen ({sub: phone})."""
    payload = _decode_or_401(creds)
    if payload.get("role") != "citizen":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Citizen token required")
    return payload


def get_current_admin(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict:
    """Returns the JWT payload for an authenticated admin.

    Payload carries: sub (username), role="admin", admin_id, institution_id,
    institution_type.
    """
    payload = _decode_or_401(creds)
    if payload.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin token required")
    return payload


def optional_citizen(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> dict | None:
    """Like get_current_citizen but returns None instead of raising — used by
    endpoints that personalise output when logged in but work anonymously too."""
    if creds is None or not creds.credentials:
        return None
    payload = decode_access_token(creds.credentials)
    if payload is None or payload.get("role") != "citizen":
        return None
    return payload


CurrentCitizen = Annotated[dict, Depends(get_current_citizen)]
CurrentAdmin = Annotated[dict, Depends(get_current_admin)]
OptionalCitizen = Annotated[dict | None, Depends(optional_citizen)]
