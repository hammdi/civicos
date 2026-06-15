"""Human-friendly reference numbers for files and issues, e.g. ``REF-2026-0A3F``."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no ambiguous chars (0/O, 1/I)


def _suffix(n: int = 5) -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(n))


def new_reference(prefix: str = "REF") -> str:
    year = datetime.now(timezone.utc).year
    return f"{prefix}-{year}-{_suffix()}"
