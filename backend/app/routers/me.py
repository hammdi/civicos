"""Personal dashboard — aggregates everything a citizen has across the modules."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentCitizen, DbSession
from app.models.documents import File
from app.models.issues import Issue
from app.models.market import Listing, Seller
from app.models.payment import Payment
from app.models.queue import Ticket
from app.models.user import User
from app.schemas.me import MeOverview, OverviewCounts

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/overview", response_model=MeOverview)
def overview(db: DbSession, citizen: CurrentCitizen):
    """Everything tied to the authenticated citizen's phone, in one call."""
    phone = citizen["sub"]
    user = db.query(User).filter(User.phone == phone).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    tickets = (
        db.query(Ticket).filter(Ticket.phone == phone).order_by(Ticket.id.desc()).limit(25).all()
    )
    files = (
        db.query(File)
        .filter(File.citizen_phone == phone)
        .order_by(File.submitted_at.desc())
        .limit(25)
        .all()
    )
    listings = (
        db.query(Listing)
        .join(Seller, Listing.seller_id == Seller.id)
        .filter(Seller.phone == phone)
        .order_by(Listing.created_at.desc())
        .limit(25)
        .all()
    )
    issues = (
        db.query(Issue)
        .filter(Issue.reporter_phone == phone)
        .order_by(Issue.created_at.desc())
        .limit(25)
        .all()
    )
    payments = (
        db.query(Payment)
        .filter(Payment.user_phone == phone)
        .order_by(Payment.id.desc())
        .limit(25)
        .all()
    )

    return MeOverview(
        user=user,
        counts=OverviewCounts(
            tickets=len(tickets),
            documents=len(files),
            listings=len(listings),
            issues=len(issues),
            payments=len(payments),
        ),
        tickets=tickets,
        documents=files,
        listings=listings,
        issues=issues,
        payments=payments,
    )
