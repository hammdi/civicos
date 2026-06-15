"""Identity verification via StateSync (national e-gov backbone)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.core.deps import CurrentCitizen, DbSession
from app.models.user import User
from app.schemas.ecosystem import DocumentVerifyResponse, IdentityStatus, IdentityVerifyRequest
from app.services import statesync

router = APIRouter(prefix="/identity", tags=["identity"])


def _current_user(db: DbSession, citizen: dict) -> User:
    user = db.query(User).filter(User.phone == citizen["sub"]).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/status", response_model=IdentityStatus)
def status(db: DbSession, citizen: CurrentCitizen):
    user = _current_user(db, citizen)
    return IdentityStatus(
        identity_verified=user.identity_verified,
        national_id=user.national_id,
        verified_at=user.identity_verified_at,
        message="Verified" if user.identity_verified else "Not yet verified",
    )


@router.post("/verify", response_model=IdentityStatus)
def verify(payload: IdentityVerifyRequest, db: DbSession, citizen: CurrentCitizen):
    """Verify the citizen's national ID against StateSync and link it."""
    user = _current_user(db, citizen)
    result = statesync.get_citizen(payload.national_id)

    if not result.available:
        # StateSync down — don't fail hard, report unavailability.
        return IdentityStatus(
            identity_verified=user.identity_verified,
            national_id=user.national_id,
            statesync_available=False,
            message=result.message,
        )
    if not result.ok:
        return IdentityStatus(
            identity_verified=False,
            national_id=None,
            statesync_available=True,
            message=result.message or "Could not confirm this national ID",
        )

    user.national_id = result.cin
    user.identity_verified = True
    user.identity_verified_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return IdentityStatus(
        identity_verified=True,
        national_id=user.national_id,
        official_name=result.full_name,
        statesync_available=True,
        verified_at=user.identity_verified_at,
        message=result.message,
    )


@router.get("/document/{reference}", response_model=DocumentVerifyResponse)
def verify_document(reference: str, citizen: CurrentCitizen):
    """Check that a StateSync-issued document reference is authentic."""
    data = statesync.verify_document(reference)
    return DocumentVerifyResponse(
        valid=bool(data.get("valid")),
        available=bool(data.get("available", True)),
        message=str(data.get("message", "")),
    )
