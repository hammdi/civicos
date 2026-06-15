"""Schemas for Module 1 — Digital Queue System."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

InstitutionType = Literal["hospital", "municipality", "post", "court", "tax_office"]
TicketStatus = Literal["waiting", "called", "serving", "served", "no_show", "cancelled"]
QueueStatus = Literal["open", "paused", "closed"]


# --- Institutions -----------------------------------------------------------
class InstitutionOut(ORMModel):
    id: int
    name: str
    type: str
    address: str | None = None
    city: str
    country: str
    avg_wait_minutes: int
    is_active: bool


class InstitutionWithLoad(InstitutionOut):
    """Institution enriched with today's live load for the listing page."""

    waiting_count: int = 0
    current_number: int = 0
    queue_status: str = "closed"
    estimated_wait_minutes: int = 0


# --- Queue state ------------------------------------------------------------
class QueueWindowOut(ORMModel):
    id: int
    window_number: int
    agent_name: str | None = None
    current_ticket_id: int | None = None


class TicketOut(ORMModel):
    id: int
    queue_id: int
    number: int
    phone: str
    service_type: str | None = None
    status: str
    created_at: datetime | None = None
    called_at: datetime | None = None
    served_at: datetime | None = None
    wait_minutes: int | None = None


class TodayQueueOut(BaseModel):
    institution: InstitutionOut
    queue_id: int | None
    date: date | None
    status: str
    current_number: int
    total_served: int
    waiting_count: int
    windows: list[QueueWindowOut] = []
    next_numbers: list[int] = []  # the next few waiting numbers


# --- Ticket creation --------------------------------------------------------
class TicketCreate(BaseModel):
    institution_id: int
    phone: str = Field(..., min_length=5, max_length=32)
    service_type: str | None = None


class TicketCreateResponse(BaseModel):
    id: int
    number: int
    position: int
    estimated_wait_minutes: int
    institution_id: int
    status: str


# --- Admin ------------------------------------------------------------------
class CallTicketResponse(BaseModel):
    ticket: TicketOut
    window_number: int | None = None
    message: str


class QueueStatsOut(BaseModel):
    institution_id: int
    date: date
    total_tickets: int
    served: int
    no_show: int
    cancelled: int
    waiting: int
    avg_wait_minutes: float
    current_number: int
    status: str
