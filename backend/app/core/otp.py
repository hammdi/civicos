"""Phone OTP issuing & verification.

Backed by Redis when available (so OTPs survive across workers and expire
automatically), with a transparent in-process fallback for local hacking.
For development the generated code is printed to the console — the spec's
`console.log(OTP)` — and optionally returned in the API response.
"""

from __future__ import annotations

import logging
import secrets
import time

from app.core.config import settings

logger = logging.getLogger("civicos.otp")

try:  # Redis is optional; degrade gracefully if it is not reachable.
    import redis  # type: ignore

    _redis: "redis.Redis | None" = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    _redis.ping()
    logger.info("OTP store: Redis at %s", settings.redis_url)
except Exception as exc:  # noqa: BLE001
    _redis = None
    logger.warning("OTP store: Redis unavailable (%s) — using in-memory fallback", exc)

# In-memory fallback: phone -> (code, expires_at_epoch)
_memory: dict[str, tuple[str, float]] = {}


def _key(phone: str) -> str:
    return f"otp:{phone}"


def generate_otp(phone: str) -> str:
    code = "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))
    ttl = settings.otp_expire_minutes * 60
    if _redis is not None:
        _redis.setex(_key(phone), ttl, code)
    else:
        _memory[phone] = (code, time.time() + ttl)

    # The required dev behaviour: surface the OTP on the console.
    print(f"\n========== CivicOS OTP ==========\n  phone: {phone}\n  code : {code}\n  (valid {settings.otp_expire_minutes} min)\n=================================\n")
    logger.info("Issued OTP for %s", phone)
    return code


def verify_otp(phone: str, code: str) -> bool:
    if _redis is not None:
        stored = _redis.get(_key(phone))
        if stored is not None and secrets.compare_digest(stored, code):
            _redis.delete(_key(phone))
            return True
        return False

    entry = _memory.get(phone)
    if not entry:
        return False
    stored, expires_at = entry
    if time.time() > expires_at:
        _memory.pop(phone, None)
        return False
    if secrets.compare_digest(stored, code):
        _memory.pop(phone, None)
        return True
    return False
