"""Queue domain logic shared by the public and admin queue routers.

Kept free of FastAPI so it is trivially unit-testable and reusable.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.queue import Institution, Queue, Ticket


def today() -> date:
    return datetime.now(timezone.utc).date()


def get_today_queue(db: Session, institution_id: int) -> Queue | None:
    return (
        db.query(Queue)
        .filter(Queue.institution_id == institution_id, Queue.date == today())
        .first()
    )


def get_or_create_today_queue(db: Session, institution_id: int) -> Queue:
    queue = get_today_queue(db, institution_id)
    if queue is None:
        queue = Queue(institution_id=institution_id, date=today(), status="closed")
        db.add(queue)
        db.flush()
    return queue


def waiting_count(db: Session, queue_id: int) -> int:
    return (
        db.query(func.count(Ticket.id))
        .filter(Ticket.queue_id == queue_id, Ticket.status == "waiting")
        .scalar()
        or 0
    )


def position_in_line(db: Session, ticket: Ticket) -> int:
    """How many people (including this ticket) are still ahead, by number."""
    ahead = (
        db.query(func.count(Ticket.id))
        .filter(
            Ticket.queue_id == ticket.queue_id,
            Ticket.status == "waiting",
            Ticket.number <= ticket.number,
        )
        .scalar()
        or 0
    )
    return int(ahead)


def estimate_wait_minutes(institution: Institution, position: int) -> int:
    """A simple, transparent estimate: people ahead × the institution's average
    service time. Position is 1-based (1 = you're next)."""
    ahead = max(position - 1, 0)
    return int(ahead * max(institution.avg_wait_minutes, 1))


def next_waiting_numbers(db: Session, queue_id: int, limit: int = 5) -> list[int]:
    rows = (
        db.query(Ticket.number)
        .filter(Ticket.queue_id == queue_id, Ticket.status == "waiting")
        .order_by(Ticket.number.asc())
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


def queue_state_payload(db: Session, institution: Institution, queue: Queue | None) -> dict:
    """The JSON broadcast over the WebSocket and returned by /today."""
    if queue is None:
        return {
            "institution_id": institution.id,
            "queue_id": None,
            "status": "closed",
            "current_number": 0,
            "total_served": 0,
            "waiting_count": 0,
            "next_numbers": [],
        }
    return {
        "institution_id": institution.id,
        "queue_id": queue.id,
        "status": queue.status,
        "current_number": queue.current_number,
        "total_served": queue.total_served,
        "waiting_count": waiting_count(db, queue.id),
        "next_numbers": next_waiting_numbers(db, queue.id),
    }
