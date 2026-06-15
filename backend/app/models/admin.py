"""Admin accounts — the only credentialed users in the platform.

Citizens authenticate with phone OTP and never hold a password; staff who
operate an institution log in with username + password.
"""

from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

# Which module / institution type an admin is scoped to.
INSTITUTION_TYPES = ("hospital", "municipality", "post", "court", "tax_office")


class Admin(Base, TimestampMixin):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)

    # An admin manages one institution (and, by extension, its module).
    institution_id: Mapped[int | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    institution_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    institution = relationship("Institution", lazy="joined")
