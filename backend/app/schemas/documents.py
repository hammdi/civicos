"""Schemas for Module 2 — Document Tracker."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

FileStatus = Literal["submitted", "processing", "ready", "delivered", "rejected"]


class DocumentTypeOut(ORMModel):
    id: int
    name: str
    institution_id: int | None = None
    required_documents: list[str] = []
    avg_processing_days: int
    fee: float = 0


class FileUpdateOut(ORMModel):
    id: int
    old_status: str | None = None
    new_status: str
    message: str | None = None
    updated_by: str | None = None
    updated_at: datetime


class FileOut(ORMModel):
    id: int
    reference_number: str
    citizen_phone: str
    document_type_id: int
    status: str
    submitted_at: datetime
    expected_ready_date: date | None = None
    notes: str | None = None
    document_type: DocumentTypeOut | None = None


class FileWithHistory(FileOut):
    updates: list[FileUpdateOut] = []


class FileCreate(BaseModel):
    citizen_phone: str = Field(..., min_length=5, max_length=32)
    document_type_id: int
    notes: str | None = None


class FileStatusUpdate(BaseModel):
    status: FileStatus
    message: str | None = None
    expected_date: date | None = None


class NotifyRequest(BaseModel):
    message: str | None = None  # if omitted a sensible default is generated


class NotificationLogOut(ORMModel):
    id: int
    phone: str
    message: str
    sent_at: datetime
    status: str
