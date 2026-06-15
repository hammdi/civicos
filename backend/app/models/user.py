"""Citizen user accounts.

The original spec used phone-OTP with no passwords; this elevates it to real
accounts: a citizen registers with a name (and optional email/password/city),
gets a verified profile and a personal dashboard that ties together their
tickets, documents, listings and reports. OTP remains the primary login;
email+password is offered as an optional convenience.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str | None] = mapped_column(String(200), unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(400), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # National identity, verified against StateSync (e-gov backbone).
    national_id: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    identity_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    identity_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
