"""Module 1 — Digital Queue System (الطابور الرقمي)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

QUEUE_STATUSES = ("open", "paused", "closed")
TICKET_STATUSES = ("waiting", "called", "serving", "served", "no_show", "cancelled")


class Institution(Base, TimestampMixin):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    # hospital | municipality | post | court | tax_office
    type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    avg_wait_minutes: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    queues = relationship("Queue", back_populates="institution", cascade="all, delete-orphan")


class Queue(Base, TimestampMixin):
    __tablename__ = "queues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_id: Mapped[int] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="closed", nullable=False)
    current_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_served: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    institution = relationship("Institution", back_populates="queues")
    tickets = relationship("Ticket", back_populates="queue", cascade="all, delete-orphan")
    windows = relationship("QueueWindow", back_populates="queue", cascade="all, delete-orphan")


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    queue_id: Mapped[int] = mapped_column(
        ForeignKey("queues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    service_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="waiting", nullable=False, index=True)

    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    called_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    served_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    wait_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    queue = relationship("Queue", back_populates="tickets")


class QueueWindow(Base):
    __tablename__ = "queue_windows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    queue_id: Mapped[int] = mapped_column(
        ForeignKey("queues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    window_number: Mapped[int] = mapped_column(Integer, nullable=False)
    agent_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    current_ticket_id: Mapped[int | None] = mapped_column(
        ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True
    )

    queue = relationship("Queue", back_populates="windows")
    current_ticket = relationship("Ticket", foreign_keys=[current_ticket_id], lazy="joined")
