"""Payments integration — IslamicFinanceOS (IFOS) as the settlement layer.

A civic fee is paid by transferring from the citizen's IFOS wallet to the
institution's payee wallet. Two providers behind one interface:

  * "ifos"  — real: logs in to IFOS and performs a wallet transfer.
  * "mock"  — dev fallback: records the payment as paid instantly.

This keeps CivicOS fully usable standalone while integrating for real when the
IslamicFinanceOS service is present and the citizen links their wallet.
"""

from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger("civicos.payments")


@dataclass
class PaymentResult:
    ok: bool
    provider: str
    status: str  # paid | failed | pending
    provider_ref: str | None = None
    message: str = ""


def _client() -> httpx.Client:
    return httpx.Client(base_url=settings.ifos_base_url, timeout=settings.ecosystem_timeout_seconds)


def _extract_token(data: dict) -> str | None:
    for key in ("access_token", "token", "jwt", "accessToken"):
        if data.get(key):
            return str(data[key])
    # Some APIs nest it under "data".
    inner = data.get("data") if isinstance(data.get("data"), dict) else None
    if inner:
        return _extract_token(inner)
    return None


def ifos_login(email: str, password: str) -> str | None:
    try:
        with _client() as client:
            resp = client.post("/auth/login", json={"email": email, "password": password})
        if resp.status_code >= 400:
            return None
        return _extract_token(resp.json())
    except httpx.HTTPError as exc:
        logger.warning("IFOS login failed: %s", exc)
        return None


def ifos_transfer(token: str, to_email: str, amount: float, note: str) -> PaymentResult:
    headers = {"Authorization": f"Bearer {token}"}
    try:
        with _client() as client:
            resp = client.post(
                "/wallet/transfer",
                headers=headers,
                json={"to_email": to_email, "amount": amount, "note": note},
            )
        if resp.status_code >= 400:
            detail = ""
            try:
                detail = resp.json().get("detail") or resp.text
            except Exception:  # noqa: BLE001
                detail = resp.text
            return PaymentResult(ok=False, provider="ifos", status="failed", message=str(detail)[:200])
        data = resp.json() if resp.content else {}
        ref = str(data.get("id") or data.get("reference") or data.get("transaction_id") or "IFOS-OK")
        return PaymentResult(
            ok=True, provider="ifos", status="paid", provider_ref=ref, message="Paid via IslamicFinanceOS"
        )
    except httpx.HTTPError as exc:
        logger.warning("IFOS transfer unreachable: %s", exc)
        return PaymentResult(
            ok=False, provider="ifos", status="pending", message="IslamicFinanceOS is temporarily unavailable"
        )


def pay_with_ifos(ifos_email: str, ifos_password: str, payee_email: str, amount: float, note: str) -> PaymentResult:
    if not settings.ifos_enabled:
        return PaymentResult(ok=False, provider="ifos", status="pending", message="IFOS disabled")
    token = ifos_login(ifos_email, ifos_password)
    if not token:
        return PaymentResult(
            ok=False, provider="ifos", status="failed", message="Could not sign in to your IslamicFinanceOS wallet"
        )
    return ifos_transfer(token, payee_email, amount, note)


def pay_mock(amount: float) -> PaymentResult:
    """Instant dev payment — records as paid with a synthetic reference."""
    ref = "MOCK-" + "".join(secrets.choice("0123456789ABCDEF") for _ in range(10))
    return PaymentResult(ok=True, provider="mock", status="paid", provider_ref=ref, message="Paid (development)")


def zakat_calculate(payload: dict) -> dict:
    """Proxy IFOS zakat calculation (used on Local Market settlements)."""
    if not settings.ifos_enabled:
        return {"available": False, "message": "IFOS disabled"}
    try:
        with _client() as client:
            resp = client.post("/zakat/calculate", json=payload)
        if resp.status_code in (401, 403):
            return {
                "available": True,
                "requires_ifos_auth": True,
                "message": "Sign in to your IslamicFinanceOS account to calculate zakat",
            }
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict):
            data["available"] = True
            return data
        return {"available": True, "result": data}
    except httpx.HTTPError as exc:
        logger.warning("IFOS zakat unreachable: %s", exc)
        return {"available": False, "message": "IslamicFinanceOS is temporarily unavailable"}
