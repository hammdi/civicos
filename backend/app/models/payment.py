"""Payments for civic fees, settled through IslamicFinanceOS (or dev mock)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

PAYMENT_PURPOSES = ("document", "queue", "market", "issue", "other")
PAYMENT_STATUSES = ("pending", "paid", "failed", "refunded")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_phone: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), default="other", nullable=False, index=True)
    # Free-form link to the thing being paid for (a file reference, listing id…).
    reference: Mapped[str | None] = mapped_column(String(60), index=True, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="TND", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    provider: Mapped[str | None] = mapped_column(String(20), nullable=True)  # ifos | mock
    provider_ref: Mapped[str | None] = mapped_column(String(80), nullable=True)
    payee_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
