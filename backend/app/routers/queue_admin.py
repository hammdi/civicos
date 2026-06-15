"""Module 1 admin API — operate the live queue (JWT protected)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException, Query, status
from sqlalchemy import func

from app.core.deps import CurrentAdmin, DbSession
from app.core.notifications import send_sms
from app.core.websocket import manager, queue_channel
from app.models.queue import Institution, Queue, QueueWindow, Ticket
from app.schemas.queue import (
    CallTicketResponse,
    QueueStatsOut,
    TicketOut,
    TodayQueueOut,
)
from app.services import queue_service as qs

router = APIRouter(prefix="/admin", tags=["admin:queue"])


def _resolve_institution(db: DbSession, admin: dict, institution_id: int | None) -> Institution:
    target_id = institution_id or admin.get("institution_id")
    if target_id is None:
        raise HTTPException(status_code=400, detail="No institution associated with this admin")
    inst = db.get(Institution, target_id)
    if inst is None:
        raise HTTPException(status_code=404, detail="Institution not found")
    # Non-superusers may only touch their own institution.
    if not admin.get("is_superuser") and admin.get("institution_id") != inst.id:
        raise HTTPException(status_code=403, detail="Not allowed to manage this institution")
    return inst


def _broadcast(db: DbSession, inst: Institution, queue: Queue, event: str) -> None:
    manager.broadcast_sync(
        queue_channel(inst.id),
        {"event": event, **qs.queue_state_payload(db, inst, queue)},
    )


def _complete_current(db: DbSession, queue: Queue) -> None:
    """Mark any currently called/serving ticket as served and tally it."""
    current = (
        db.query(Ticket)
        .filter(Ticket.queue_id == queue.id, Ticket.status.in_(("called", "serving")))
        .order_by(Ticket.number.asc())
        .all()
    )
    now = datetime.now(timezone.utc)
    for t in current:
        t.status = "served"
        t.served_at = now
        if t.created_at and t.wait_minutes is None:
            delta = (now - t.created_at).total_seconds() / 60.0
            t.wait_minutes = max(int(round(delta)), 0)
        queue.total_served += 1
    # Clear window assignments.
    for w in queue.windows:
        w.current_ticket_id = None


# --- Dashboard --------------------------------------------------------------
@router.get("/dashboard", response_model=TodayQueueOut)
def dashboard(db: DbSession, admin: CurrentAdmin, institution_id: int | None = Query(None)):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_today_queue(db, inst.id)
    return TodayQueueOut(
        institution=inst,
        queue_id=queue.id if queue else None,
        date=queue.date if queue else None,
        status=queue.status if queue else "closed",
        current_number=queue.current_number if queue else 0,
        total_served=queue.total_served if queue else 0,
        waiting_count=qs.waiting_count(db, queue.id) if queue else 0,
        windows=queue.windows if queue else [],
        next_numbers=qs.next_waiting_numbers(db, queue.id, limit=10) if queue else [],
    )


# --- Open / pause / close ---------------------------------------------------
@router.post("/queue/open", response_model=TodayQueueOut)
def open_queue(
    db: DbSession,
    admin: CurrentAdmin,
    institution_id: int | None = Query(None),
    windows: int = Body(1, embed=True, ge=1, le=50),
):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_or_create_today_queue(db, inst.id)
    queue.status = "open"
    if queue.opened_at is None:
        queue.opened_at = datetime.now(timezone.utc)
    # Ensure the requested number of service windows exist.
    existing = {w.window_number for w in queue.windows}
    for n in range(1, windows + 1):
        if n not in existing:
            db.add(QueueWindow(queue_id=queue.id, window_number=n, agent_name=f"Window {n}"))
    db.commit()
    db.refresh(queue)
    _broadcast(db, inst, queue, "queue_opened")
    return dashboard(db, admin, inst.id)


@router.post("/queue/pause", response_model=TodayQueueOut)
def pause_queue(db: DbSession, admin: CurrentAdmin, institution_id: int | None = Query(None)):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_today_queue(db, inst.id)
    if queue is None:
        raise HTTPException(status_code=409, detail="No queue to pause")
    queue.status = "paused"
    db.commit()
    _broadcast(db, inst, queue, "queue_paused")
    return dashboard(db, admin, inst.id)


@router.post("/queue/close", response_model=TodayQueueOut)
def close_queue(db: DbSession, admin: CurrentAdmin, institution_id: int | None = Query(None)):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_today_queue(db, inst.id)
    if queue is None:
        raise HTTPException(status_code=409, detail="No queue to close")
    queue.status = "closed"
    queue.closed_at = datetime.now(timezone.utc)
    db.commit()
    _broadcast(db, inst, queue, "queue_closed")
    return dashboard(db, admin, inst.id)


# --- Calling numbers --------------------------------------------------------
def _call_ticket(db: DbSession, inst: Institution, queue: Queue, ticket: Ticket) -> CallTicketResponse:
    now = datetime.now(timezone.utc)
    ticket.status = "called"
    ticket.called_at = now
    queue.current_number = ticket.number
    # Assign to the first window (or create one if none exist).
    window = queue.windows[0] if queue.windows else None
    if window is None:
        window = QueueWindow(queue_id=queue.id, window_number=1, agent_name="Window 1")
        db.add(window)
        db.flush()
    window.current_ticket_id = ticket.id
    db.commit()
    db.refresh(ticket)

    # Notify the citizen their number is up.
    send_sms(ticket.phone, f"CivicOS — your number {ticket.number} is now being called at {inst.name}.", db)
    _broadcast(db, inst, queue, "ticket_called")
    return CallTicketResponse(
        ticket=TicketOut.model_validate(ticket),
        window_number=window.window_number,
        message=f"Now serving number {ticket.number}",
    )


@router.post("/queue/next", response_model=CallTicketResponse)
def call_next(db: DbSession, admin: CurrentAdmin, institution_id: int | None = Query(None)):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_today_queue(db, inst.id)
    if queue is None or queue.status == "closed":
        raise HTTPException(status_code=409, detail="Queue is not open")

    _complete_current(db, queue)
    nxt = (
        db.query(Ticket)
        .filter(Ticket.queue_id == queue.id, Ticket.status == "waiting")
        .order_by(Ticket.number.asc())
        .first()
    )
    if nxt is None:
        db.commit()
        _broadcast(db, inst, queue, "queue_empty")
        raise HTTPException(status_code=404, detail="No one is waiting")
    return _call_ticket(db, inst, queue, nxt)


@router.post("/queue/call/{number}", response_model=CallTicketResponse)
def call_specific(
    number: int, db: DbSession, admin: CurrentAdmin, institution_id: int | None = Query(None)
):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_today_queue(db, inst.id)
    if queue is None or queue.status == "closed":
        raise HTTPException(status_code=409, detail="Queue is not open")
    ticket = (
        db.query(Ticket)
        .filter(Ticket.queue_id == queue.id, Ticket.number == number)
        .first()
    )
    if ticket is None:
        raise HTTPException(status_code=404, detail=f"No ticket with number {number} today")
    if ticket.status in ("served", "cancelled", "no_show"):
        raise HTTPException(status_code=409, detail=f"Ticket already {ticket.status}")
    _complete_current(db, queue)
    return _call_ticket(db, inst, queue, ticket)


@router.post("/tickets/{ticket_id}/no-show", response_model=TicketOut)
def mark_no_show(ticket_id: int, db: DbSession, admin: CurrentAdmin):
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    inst = _resolve_institution(db, admin, ticket.queue.institution_id)
    ticket.status = "no_show"
    for w in ticket.queue.windows:
        if w.current_ticket_id == ticket.id:
            w.current_ticket_id = None
    db.commit()
    db.refresh(ticket)
    _broadcast(db, inst, ticket.queue, "ticket_no_show")
    return ticket


@router.post("/tickets/{ticket_id}/served", response_model=TicketOut)
def mark_served(ticket_id: int, db: DbSession, admin: CurrentAdmin):
    """Convenience: finish serving a ticket without calling the next one."""
    ticket = db.get(Ticket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    inst = _resolve_institution(db, admin, ticket.queue.institution_id)
    if ticket.status == "served":
        return ticket
    now = datetime.now(timezone.utc)
    ticket.status = "served"
    ticket.served_at = now
    if ticket.created_at and ticket.wait_minutes is None:
        ticket.wait_minutes = max(int(round((now - ticket.created_at).total_seconds() / 60.0)), 0)
    ticket.queue.total_served += 1
    for w in ticket.queue.windows:
        if w.current_ticket_id == ticket.id:
            w.current_ticket_id = None
    db.commit()
    db.refresh(ticket)
    _broadcast(db, inst, ticket.queue, "ticket_served")
    return ticket


# --- Stats ------------------------------------------------------------------
@router.get("/stats", response_model=QueueStatsOut)
def stats(db: DbSession, admin: CurrentAdmin, institution_id: int | None = Query(None)):
    inst = _resolve_institution(db, admin, institution_id)
    queue = qs.get_today_queue(db, inst.id)
    if queue is None:
        raise HTTPException(status_code=404, detail="No queue today yet")

    def count(status_value: str) -> int:
        return (
            db.query(func.count(Ticket.id))
            .filter(Ticket.queue_id == queue.id, Ticket.status == status_value)
            .scalar()
            or 0
        )

    total = db.query(func.count(Ticket.id)).filter(Ticket.queue_id == queue.id).scalar() or 0
    avg_wait = (
        db.query(func.coalesce(func.avg(Ticket.wait_minutes), 0.0))
        .filter(Ticket.queue_id == queue.id, Ticket.status == "served")
        .scalar()
    )
    return QueueStatsOut(
        institution_id=inst.id,
        date=queue.date,
        total_tickets=int(total),
        served=count("served"),
        no_show=count("no_show"),
        cancelled=count("cancelled"),
        waiting=count("waiting"),
        avg_wait_minutes=round(float(avg_wait or 0.0), 1),
        current_number=queue.current_number,
        status=queue.status,
    )
