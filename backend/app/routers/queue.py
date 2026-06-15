"""Module 1 public API — institutions, tickets, live queue WebSocket."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import func, or_

from app.core.deps import DbSession
from app.core.websocket import manager, queue_channel
from app.models.queue import Institution, Ticket
from app.schemas.queue import (
    InstitutionWithLoad,
    TicketCreate,
    TicketCreateResponse,
    TicketOut,
    TodayQueueOut,
)
from app.services import queue_service as qs

router = APIRouter(tags=["queue"])


# --- Institutions -----------------------------------------------------------
@router.get("/institutions", response_model=list[InstitutionWithLoad])
def list_institutions(
    db: DbSession,
    q: str | None = Query(None, description="Free-text search on name/address"),
    city: str | None = None,
    country: str | None = None,
    type: str | None = Query(None, description="hospital|municipality|post|court|tax_office"),
    active_only: bool = True,
):
    """List and search institutions, each enriched with today's live load."""
    query = db.query(Institution)
    if active_only:
        query = query.filter(Institution.is_active.is_(True))
    if city:
        query = query.filter(Institution.city.ilike(f"%{city}%"))
    if country:
        query = query.filter(Institution.country.ilike(f"%{country}%"))
    if type:
        query = query.filter(Institution.type == type)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Institution.name.ilike(like), Institution.address.ilike(like)))

    results: list[InstitutionWithLoad] = []
    for inst in query.order_by(Institution.name.asc()).all():
        queue = qs.get_today_queue(db, inst.id)
        waiting = qs.waiting_count(db, queue.id) if queue else 0
        results.append(
            InstitutionWithLoad(
                **InstitutionWithLoad.model_validate(inst).model_dump(
                    exclude={"waiting_count", "current_number", "queue_status", "estimated_wait_minutes"}
                ),
                waiting_count=waiting,
                current_number=queue.current_number if queue else 0,
                queue_status=queue.status if queue else "closed",
                estimated_wait_minutes=qs.estimate_wait_minutes(inst, waiting + 1),
            )
        )
    return results


@router.get("/institutions/{institution_id}/today", response_model=TodayQueueOut)
def institution_today(institution_id: int, db: DbSession):
    inst = db.get(Institution, institution_id)
    if inst is None:
        raise HTTPException(status_code=404, detail="Institution not found")
    queue = qs.get_today_queue(db, institution_id)
    return TodayQueueOut(
        institution=inst,
        queue_id=queue.id if queue else None,
        date=queue.date if queue else None,
        status=queue.status if queue else "closed",
        current_number=queue.current_number if queue else 0,
        total_served=queue.total_served if queue else 0,
        waiting_count=qs.waiting_count(db, queue.id) if queue else 0,
        windows=queue.windows if queue else [],
        next_numbers=qs.next_waiting_numbers(db, queue.id) if queue else [],
    )


# --- Tickets ----------------------------------------------------------------
@router.post("/tickets", response_model=TicketCreateResponse, status_code=status.HTTP_201_CREATED)
def take_ticket(payload: TicketCreate, db: DbSession):
    inst = db.get(Institution, payload.institution_id)
    if inst is None or not inst.is_active:
        raise HTTPException(status_code=404, detail="Institution not available")

    queue = qs.get_or_create_today_queue(db, payload.institution_id)
    if queue.status == "closed":
        raise HTTPException(status_code=409, detail="Queue is closed for today")
    if queue.status == "paused":
        raise HTTPException(status_code=409, detail="Queue is paused; please try again shortly")

    # Next number = current max number in this queue + 1.
    last_number = (
        db.query(func.coalesce(func.max(Ticket.number), 0))
        .filter(Ticket.queue_id == queue.id)
        .scalar()
    )
    number = int(last_number) + 1
    ticket = Ticket(
        queue_id=queue.id,
        number=number,
        phone=payload.phone,
        service_type=payload.service_type,
        status="waiting",
        created_at=datetime.now(timezone.utc),
    )
    db.add(ticket)
    db.flush()

    position = qs.position_in_line(db, ticket)
    eta = qs.estimate_wait_minutes(inst, position)
    db.commit()

    # Tell every live board a new ticket joined.
    manager.broadcast_sync(
        queue_channel(inst.id),
        {"event": "ticket_created", **qs.queue_state_payload(db, inst, queue)},
    )

    return TicketCreateResponse(
        id=ticket.id,
        number=number,
        position=position,
        estimated_wait_minutes=eta,
        institution_id=inst.id,
        status=ticket.status,
    )


@router.get("/tickets/{phone}", response_model=list[TicketOut])
def my_tickets(phone: str, db: DbSession):
    """All of a citizen's tickets, most recent first."""
    tickets = (
        db.query(Ticket)
        .filter(Ticket.phone == phone)
        .order_by(Ticket.id.desc())
        .limit(50)
        .all()
    )
    return tickets


@router.delete("/tickets/{ticket_id}", response_model=TicketOut)
def cancel_ticket(ticket_id: int, db: DbSession):
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status in ("served", "no_show", "cancelled"):
        raise HTTPException(status_code=409, detail=f"Ticket already {ticket.status}")
    ticket.status = "cancelled"
    db.commit()

    inst = db.get(Institution, ticket.queue.institution_id)
    manager.broadcast_sync(
        queue_channel(inst.id),
        {"event": "ticket_cancelled", **qs.queue_state_payload(db, inst, ticket.queue)},
    )
    db.refresh(ticket)
    return ticket


# --- Live queue WebSocket ---------------------------------------------------
@router.websocket("/ws/queue/{institution_id}")
async def queue_ws(websocket: WebSocket, institution_id: int):
    """Subscribe to live queue updates for an institution.

    On connect the current snapshot is pushed immediately; thereafter the
    client receives an event whenever a ticket is taken, called or finished.
    """
    channel = queue_channel(institution_id)
    await manager.connect(channel, websocket)
    try:
        # Push an initial snapshot using a short-lived DB session.
        from app.core.database import SessionLocal

        db = SessionLocal()
        try:
            inst = db.get(Institution, institution_id)
            if inst is not None:
                queue = qs.get_today_queue(db, institution_id)
                await websocket.send_json(
                    {"event": "snapshot", **qs.queue_state_payload(db, inst, queue)}
                )
        finally:
            db.close()

        # Keep the socket open; we ignore inbound messages (pure broadcast feed).
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(channel, websocket)
    except Exception:  # noqa: BLE001
        await manager.disconnect(channel, websocket)
