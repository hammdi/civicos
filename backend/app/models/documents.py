"""Module 2 — Document Tracker (تتبع الوثائق)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

FILE_STATUSES = ("submitted", "processing", "ready", "delivered", "rejected")


class DocumentType(Base, TimestampMixin):
    __tablename__ = "document_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    institution_id: Mapped[int | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # e.g. ["national ID copy", "2 photos", "birth certificate"]
    required_documents: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    avg_processing_days: Mapped[int] = mapped_column(Integer, default=7, nullable=False)
    # Official fee for this document (0 = free). Collected via IslamicFinanceOS.
    fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)

    institution = relationship("Institution", lazy="joined")
    files = relationship("File", back_populates="document_type")


class File(Base):
    __tablename__ = "files"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_number: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    citizen_phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    document_type_id: Mapped[int] = mapped_column(
        ForeignKey("document_types.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="submitted", nullable=False, index=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expected_ready_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    document_type = relationship("DocumentType", back_populates="files")
    updates = relationship(
        "FileUpdate",
        back_populates="file",
        cascade="all, delete-orphan",
        order_by="FileUpdate.updated_at",
    )


class FileUpdate(Base):
    __tablename__ = "file_updates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    file_id: Mapped[int] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    old_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_status: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(160), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    file = relationship("File", back_populates="updates")


class NotificationLog(Base):
    __tablename__ = "notifications_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="logged", nullable=False)
