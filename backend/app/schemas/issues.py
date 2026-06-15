"""Schemas for Module 4 — Urban Issue Reporter."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

IssueStatus = Literal["reported", "acknowledged", "in_progress", "resolved", "closed"]
IssuePriority = Literal["low", "medium", "high", "urgent"]


class IssueCategoryOut(ORMModel):
    id: int
    name: str
    icon: str | None = None
    responsible_dept: str | None = None


class IssueUpdateOut(ORMModel):
    id: int
    status: str
    message: str | None = None
    updated_by: str | None = None
    photo: str | None = None
    updated_at: datetime


class IssueOut(ORMModel):
    id: int
    reference_number: str
    reporter_phone: str
    category_id: int | None = None
    title: str
    description: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    address: str | None = None
    city: str | None = None
    photos: list[str] = []
    status: str
    priority: str
    assigned_dept: str | None = None
    upvote_count: int
    created_at: datetime
    resolved_at: datetime | None = None
    resolution_note: str | None = None
    category: IssueCategoryOut | None = None


class IssueWithHistory(IssueOut):
    updates: list[IssueUpdateOut] = []


class IssueCreate(BaseModel):
    reporter_phone: str = Field(..., min_length=5, max_length=32)
    category_id: int | None = None
    title: str = Field(..., min_length=3, max_length=200)
    description: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    address: str | None = None
    city: str | None = None
    photos: list[str] = []
    priority: IssuePriority = "medium"


class IssueStatusUpdate(BaseModel):
    status: IssueStatus
    message: str | None = None
    photo: str | None = None


class IssueAssign(BaseModel):
    department: str
    priority: IssuePriority | None = None


class UpvoteRequest(BaseModel):
    voter_phone: str = Field(..., min_length=5, max_length=32)


class IssueStatsOut(BaseModel):
    city: str | None = None
    total: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
    by_category: dict[str, int]
    resolved_rate: float
    avg_resolution_days: float | None = None
