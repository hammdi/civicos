"""Payments for civic fees, settled via IslamicFinanceOS (or dev mock)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.core.deps import CurrentCitizen, DbSession
from app.models.payment import Payment
from app.schemas.ecosystem import (
    PaymentCreate,
    PaymentOut,
    PaymentPayRequest,
    ZakatRequest,
)
from app.services import payments as pay_service

router = APIRouter(prefix="/payments", tags=["payments"])


def _owned(db: DbSession, payment_id: int, phone: str) -> Payment:
    payment = db.get(Payment, payment_id)
    if payment is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.user_phone != phone:
        raise HTTPException(status_code=403, detail="Not your payment")
    return payment


@router.get("", response_model=list[PaymentOut])
def my_payments(db: DbSession, citizen: CurrentCitizen):
    return (
        db.query(Payment)
        .filter(Payment.user_phone == citizen["sub"])
        .order_by(Payment.id.desc())
        .all()
    )


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(payload: PaymentCreate, db: DbSession, citizen: CurrentCitizen):
    payment = Payment(
        user_phone=citizen["sub"],
        purpose=payload.purpose,
        reference=payload.reference,
        description=payload.description,
        amount=payload.amount,
        payee_email=payload.payee_email or settings.ifos_payee_email,
        status="pending",
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(payment_id: int, db: DbSession, citizen: CurrentCitizen):
    return _owned(db, payment_id, citizen["sub"])


@router.post("/{payment_id}/pay", response_model=PaymentOut)
def pay(payment_id: int, payload: PaymentPayRequest, db: DbSession, citizen: CurrentCitizen):
    payment = _owned(db, payment_id, citizen["sub"])
    if payment.status == "paid":
        return payment

    payee = payment.payee_email or settings.ifos_payee_email
    note = payment.description or f"CivicOS {payment.purpose} fee"

    if payload.method == "ifos":
        if not payload.ifos_email or not payload.ifos_password:
            raise HTTPException(status_code=400, detail="IslamicFinanceOS wallet credentials required")
        result = pay_service.pay_with_ifos(
            payload.ifos_email, payload.ifos_password, payee, float(payment.amount), note
        )
    else:
        result = pay_service.pay_mock(float(payment.amount))

    payment.provider = result.provider
    payment.status = result.status
    if result.ok:
        payment.provider_ref = result.provider_ref
        payment.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(payment)

    if not result.ok:
        # Surface the reason but keep the (now failed/pending) record.
        raise HTTPException(status_code=402, detail=result.message or "Payment failed")
    return payment


@router.post("/zakat/estimate")
def zakat_estimate(payload: ZakatRequest, citizen: CurrentCitizen):
    """Estimate zakat due via IslamicFinanceOS (used for market settlements)."""
    return pay_service.zakat_calculate(payload.model_dump())
