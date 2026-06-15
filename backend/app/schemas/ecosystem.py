"""Schemas for the ecosystem integrations: identity (StateSync) & payments (IFOS)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

# --- Identity (StateSync) ---------------------------------------------------
class IdentityVerifyRequest(BaseModel):
    national_id: str = Field(..., min_length=4, max_length=40, examples=["10000001"])


class IdentityStatus(BaseModel):
    identity_verified: bool
    national_id: str | None = None
    official_name: str | None = None
    statesync_available: bool = True
    message: str = ""
    verified_at: datetime | None = None


class DocumentVerifyResponse(BaseModel):
    valid: bool
    available: bool = True
    message: str = ""


# --- Payments (IslamicFinanceOS) -------------------------------------------
PaymentPurpose = Literal["document", "queue", "market", "issue", "other"]


class PaymentOut(ORMModel):
    id: int
    user_phone: str
    purpose: str
    reference: str | None = None
    description: str | None = None
    amount: float
    currency: str
    status: str
    provider: str | None = None
    provider_ref: str | None = None
    payee_email: str | None = None
    created_at: datetime
    paid_at: datetime | None = None


class PaymentCreate(BaseModel):
    purpose: PaymentPurpose = "other"
    reference: str | None = None
    description: str | None = None
    amount: float = Field(..., gt=0)
    payee_email: str | None = None


class PaymentPayRequest(BaseModel):
    method: Literal["ifos", "mock"] = "mock"
    # Only needed for method="ifos" — the citizen's IslamicFinanceOS wallet login.
    ifos_email: str | None = None
    ifos_password: str | None = None


class ZakatRequest(BaseModel):
    cash_and_savings: float = 0
    investments: float = 0
    gold_silver_value: float = 0
    business_assets: float = 0
    debts_owed_to_you: float = 0
    debts_you_owe: float = 0
    expenses: float = 0
