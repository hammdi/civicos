"""Module 2 admin API — process files and notify citizens (JWT protected)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.core.deps import CurrentAdmin, DbSession
from app.core.notifications import send_sms
from app.core.websocket import file_channel, manager
from app.models.documents import DocumentType, File, FileUpdate
from app.schemas.common import Message
from app.schemas.documents import FileOut, FileStatusUpdate, FileWithHistory, NotifyRequest

router = APIRouter(prefix="/admin", tags=["admin:documents"])

_STATUS_MESSAGES = {
    "submitted": "Your file {ref} has been received.",
    "processing": "Your file {ref} is now being processed.",
    "ready": "Good news! Your document for {ref} is ready for pickup.",
    "delivered": "Your document {ref} has been delivered. Thank you.",
    "rejected": "Your file {ref} could not be processed. Please contact the office.",
}


def _admin_scoped_files_query(db: DbSession, admin: dict):
    """Restrict a non-superuser admin to files of their own institution."""
    query = db.query(File)
    if not admin.get("is_superuser") and admin.get("institution_id"):
        query = query.join(DocumentType).filter(
            DocumentType.institution_id == admin["institution_id"]
        )
    return query


@router.get("/files", response_model=list[FileWithHistory])
def list_files(
    db: DbSession,
    admin: CurrentAdmin,
    status: str | None = Query(None, description="Filter by file status"),
    phone: str | None = None,
):
    query = _admin_scoped_files_query(db, admin)
    if status:
        query = query.filter(File.status == status)
    if phone:
        query = query.filter(File.citizen_phone == phone)
    return query.order_by(File.submitted_at.desc()).limit(500).all()


@router.put("/files/{file_id}/status", response_model=FileWithHistory)
def update_status(file_id: int, payload: FileStatusUpdate, db: DbSession, admin: CurrentAdmin):
    file = db.get(File, file_id)
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")

    old_status = file.status
    file.status = payload.status
    if payload.expected_date is not None:
        file.expected_ready_date = payload.expected_date

    update = FileUpdate(
        file_id=file.id,
        old_status=old_status,
        new_status=payload.status,
        message=payload.message,
        updated_by=admin.get("sub", "admin"),
    )
    db.add(update)
    db.commit()
    db.refresh(file)

    # Auto-notify the citizen on every status change.
    msg = payload.message or _STATUS_MESSAGES.get(payload.status, "Your file status changed.").format(
        ref=file.reference_number
    )
    send_sms(file.citizen_phone, msg, db)

    manager.broadcast_sync(
        file_channel(file.reference_number),
        {
            "event": "status_changed",
            "reference": file.reference_number,
            "old_status": old_status,
            "status": file.status,
            "message": payload.message,
        },
    )
    return file


@router.post("/files/{file_id}/notify", response_model=Message)
def notify(file_id: int, payload: NotifyRequest, db: DbSession, admin: CurrentAdmin):
    file = db.get(File, file_id)
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")
    msg = payload.message or _STATUS_MESSAGES.get(file.status, "Update on your file {ref}.").format(
        ref=file.reference_number
    )
    status_result = send_sms(file.citizen_phone, msg, db)
    return Message(message=f"Notification {status_result} to {file.citizen_phone}")
