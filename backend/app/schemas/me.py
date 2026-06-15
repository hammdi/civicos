"""Aggregated 'my account' overview schema."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.auth import UserOut
from app.schemas.documents import FileOut
from app.schemas.ecosystem import PaymentOut
from app.schemas.issues import IssueOut
from app.schemas.market import ListingOut
from app.schemas.queue import TicketOut


class OverviewCounts(BaseModel):
    tickets: int
    documents: int
    listings: int
    issues: int
    payments: int = 0


class MeOverview(BaseModel):
    user: UserOut
    counts: OverviewCounts
    tickets: list[TicketOut] = []
    documents: list[FileOut] = []
    listings: list[ListingOut] = []
    issues: list[IssueOut] = []
    payments: list[PaymentOut] = []
