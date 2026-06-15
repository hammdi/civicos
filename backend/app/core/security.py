"""Password hashing and JWT helpers shared by citizen (OTP) and admin auth."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# pbkdf2_sha256 is pure-Python and avoids the passlib/native-bcrypt version
# coupling. bcrypt is kept as a recognised scheme so existing bcrypt hashes
# (e.g. migrated from another system) still verify.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


# --- Passwords (admin accounts only — citizens never have passwords) --------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# --- JWT --------------------------------------------------------------------
def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    """Issue a signed token valid for `JWT_EXPIRE_DAYS`.

    `role` is either "citizen" or "admin". `extra` carries module context such
    as the institution an admin manages.
    """
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_expire_days)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None
