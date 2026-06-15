"""Module 2 public API — submit and track administrative files."""

from __future__ import annotations

from datetime import timedelta

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, status

from app.core.config import settings
from app.core.deps import DbSession
from app.core.refs import new_reference
from app.core.websocket import file_channel, manager
from app.models.documents import DocumentType, File, FileUpdate
from app.models.payment import Payment
from app.models.queue import Institution
from app.services import queue_service as qs  # reused for today()
from app.schemas.documents import (
    DocumentTypeOut,
    FileCreate,
    FileOut,
    FileUpdateOut,
    FileWithHistory,
)

router = APIRouter(tags=["documents"])


@router.get("/document-types", response_model=list[DocumentTypeOut])
def list_document_types(db: DbSession, institution_id: int | None = None):
    query = db.query(DocumentType)
    if institution_id:
        query = query.filter(DocumentType.institution_id == institution_id)
    return query.order_by(DocumentType.name.asc()).all()


@router.post("/files", response_model=FileWithHistory, status_code=status.HTTP_201_CREATED)
def submit_file(payload: FileCreate, db: DbSession):
    doc_type = db.get(DocumentType, payload.document_type_id)
    if doc_type is None:
        raise HTTPException(status_code=404, detail="Document type not found")

    # Unique, human-friendly reference number.
    reference = new_reference("REF")
    while db.query(File).filter(File.reference_number == reference).first() is not None:
        reference = new_reference("REF")

    expected = qs.today() + timedelta(days=doc_type.avg_processing_days)
    file = File(
        reference_number=reference,
        citizen_phone=payload.citizen_phone,
        document_type_id=doc_type.id,
        status="submitted",
        expected_ready_date=expected,
        notes=payload.notes,
    )
    db.add(file)
    db.flush()
    db.add(
        FileUpdate(
            file_id=file.id,
            old_status=None,
            new_status="submitted",
            message="File request submitted",
            updated_by="system",
        )
    )

    # If this document carries an official fee, open a pending payment for it.
    if doc_type.fee and float(doc_type.fee) > 0:
        institution = (
            db.get(Institution, doc_type.institution_id) if doc_type.institution_id else None
        )
        db.add(
            Payment(
                user_phone=payload.citizen_phone,
                purpose="document",
                reference=file.reference_number,
                description=f"{doc_type.name} fee",
                amount=doc_type.fee,
                payee_email=(institution.payee_email if institution else None) or settings.ifos_payee_email,
                status="pending",
            )
        )

    db.commit()
    db.refresh(file)
    return file


@router.get("/files/phone/{phone}", response_model=list[FileOut])
def files_by_phone(phone: str, db: DbSession):
    return (
        db.query(File)
        .filter(File.citizen_phone == phone)
        .order_by(File.submitted_at.desc())
        .all()
    )


@router.get("/files/{reference}", response_model=FileWithHistory)
def track_file(reference: str, db: DbSession):
    file = db.query(File).filter(File.reference_number == reference).first()
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")
    return file


@router.get("/files/{reference}/history", response_model=list[FileUpdateOut])
def file_history(reference: str, db: DbSession):
    file = db.query(File).filter(File.reference_number == reference).first()
    if file is None:
        raise HTTPException(status_code=404, detail="File not found")
    return file.updates


@router.websocket("/ws/files/{reference}")
async def file_ws(websocket: WebSocket, reference: str):
    channel = file_channel(reference)
    await manager.connect(channel, websocket)
    try:
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            file = db.query(File).filter(File.reference_number == reference).first()
            if file is not None:
                await websocket.send_json(
                    {"event": "snapshot", "reference": reference, "status": file.status}
                )
        finally:
            db.close()
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(channel, websocket)
    except Exception:  # noqa: BLE001
        await manager.disconnect(channel, websocket)
