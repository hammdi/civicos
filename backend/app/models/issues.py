"""Module 4 — Urban Issue Reporter (بلاغ مشكل)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

ISSUE_STATUSES = ("reported", "acknowledged", "in_progress", "resolved", "closed")
ISSUE_PRIORITIES = ("low", "medium", "high", "urgent")


class IssueCategory(Base):
    __tablename__ = "issue_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    icon: Mapped[str | None] = mapped_column(String(80), nullable=True)
    responsible_dept: Mapped[str | None] = mapped_column(String(160), nullable=True)

    issues = relationship("Issue", back_populates="category")


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    reporter_phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("issue_categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    photos: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="reported", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False, index=True)
    assigned_dept: Mapped[str | None] = mapped_column(String(160), nullable=True)
    upvote_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    category = relationship("IssueCategory", back_populates="issues", lazy="joined")
    updates = relationship(
        "IssueUpdate",
        back_populates="issue",
        cascade="all, delete-orphan",
        order_by="IssueUpdate.updated_at",
    )
    upvotes = relationship("Upvote", back_populates="issue", cascade="all, delete-orphan")


class IssueUpdate(Base):
    __tablename__ = "issue_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    issue = relationship("Issue", back_populates="updates")


class Upvote(Base):
    __tablename__ = "upvotes"
    __table_args__ = (UniqueConstraint("issue_id", "voter_phone", name="uq_issue_voter"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    voter_phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    issue = relationship("Issue", back_populates="upvotes")
