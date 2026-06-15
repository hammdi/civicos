"""Lightweight unit tests that need no database or network.

Run:  cd backend && pip install pytest && pytest
"""

from __future__ import annotations

import re

from app.core.refs import new_reference
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.models.queue import Institution
from app.services.queue_service import estimate_wait_minutes


def test_reference_format():
    ref = new_reference("REF")
    assert re.match(r"^REF-\d{4}-[A-Z0-9]{5}$", ref), ref
    # Two references should (almost surely) differ.
    assert new_reference("ISS") != new_reference("ISS")


def test_password_hashing_roundtrip():
    hashed = hash_password("civicos123")
    assert hashed != "civicos123"
    assert verify_password("civicos123", hashed)
    assert not verify_password("wrong", hashed)


def test_jwt_roundtrip_and_role():
    token = create_access_token("+21655123456", "citizen")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "+21655123456"
    assert payload["role"] == "citizen"


def test_jwt_rejects_tampered_token():
    token = create_access_token("user", "admin")
    assert decode_access_token(token + "x") is None


def test_wait_estimate_scales_with_position():
    inst = Institution(name="X", type="post", city="Tunis", country="TN", avg_wait_minutes=10)
    assert estimate_wait_minutes(inst, position=1) == 0  # you're next
    assert estimate_wait_minutes(inst, position=4) == 30  # 3 people ahead × 10
