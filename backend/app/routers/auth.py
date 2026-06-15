"""Authentication — citizen accounts (OTP + optional password) and admin login."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_

from app.core.config import settings
from app.core.deps import CurrentCitizen, DbSession
from app.core.otp import generate_otp, verify_otp
from app.core.security import create_access_token, hash_password, verify_password
from app.models.admin import Admin
from app.models.user import User
from app.schemas.auth import (
    AdminLogin,
    AdminTokenResponse,
    OTPRequest,
    OTPRequestResponse,
    OTPVerify,
    PasswordLogin,
    RegisterRequest,
    TokenResponse,
    UpdateProfile,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _avatar_for(name: str) -> str:
    """A deterministic, friendly default avatar (DiceBear initials, no key needed)."""
    seed = (name or "Citizen").replace(" ", "+")
    return f"https://api.dicebear.com/7.x/initials/svg?seed={seed}&backgroundColor=1B4F72"


def _issue_token(user: User) -> TokenResponse:
    token = create_access_token(
        subject=user.phone,
        role="citizen",
        extra={"user_id": user.id, "name": user.name},
    )
    return TokenResponse(
        access_token=token,
        expires_in_days=settings.jwt_expire_days,
        user=UserOut.model_validate(user),
    )


@router.post("/register", response_model=OTPRequestResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: DbSession):
    """Start registration: create (or update) the account and send an OTP.

    The account becomes verified once the OTP is confirmed via /auth/verify-otp.
    """
    user = db.query(User).filter(User.phone == payload.phone).first()
    if payload.email:
        clash = db.query(User).filter(User.email == payload.email, User.phone != payload.phone).first()
        if clash:
            raise HTTPException(status_code=409, detail="Email already in use")

    if user is None:
        user = User(phone=payload.phone, name=payload.name)
        db.add(user)
    user.name = payload.name or user.name
    user.email = payload.email or user.email
    user.city = payload.city or user.city
    if payload.password:
        user.password_hash = hash_password(payload.password)
    if not user.avatar_url:
        user.avatar_url = _avatar_for(user.name)
    db.commit()

    code = generate_otp(payload.phone)
    return OTPRequestResponse(
        message=f"Account created. OTP sent to {payload.phone}.",
        is_new_user=True,
        debug_otp=code if settings.otp_debug_return else None,
    )


@router.post("/request-otp", response_model=OTPRequestResponse)
def request_otp(payload: OTPRequest, db: DbSession):
    """Send a login OTP. Works for both existing and brand-new phone numbers."""
    existing = db.query(User).filter(User.phone == payload.phone).first()
    code = generate_otp(payload.phone)
    return OTPRequestResponse(
        message=f"OTP sent to {payload.phone}",
        is_new_user=existing is None,
        debug_otp=code if settings.otp_debug_return else None,
    )


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp_endpoint(payload: OTPVerify, db: DbSession):
    """Confirm an OTP, creating/verifying the account, and return a 30-day JWT."""
    if not verify_otp(payload.phone, payload.otp):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP")

    user = db.query(User).filter(User.phone == payload.phone).first()
    if user is None:
        user = User(phone=payload.phone, name=payload.name or f"Citizen {payload.phone[-4:]}")
        db.add(user)
    # Apply any profile fields supplied during a registration verification.
    if payload.name:
        user.name = payload.name
    if payload.email:
        user.email = payload.email
    if payload.city:
        user.city = payload.city
    if not user.avatar_url:
        user.avatar_url = _avatar_for(user.name)
    user.is_verified = True
    db.commit()
    db.refresh(user)
    return _issue_token(user)


@router.post("/login", response_model=TokenResponse)
def password_login(payload: PasswordLogin, db: DbSession):
    """Optional password login by phone or email."""
    user = (
        db.query(User)
        .filter(or_(User.phone == payload.identifier, User.email == payload.identifier))
        .first()
    )
    if user is None or not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return _issue_token(user)


@router.get("/me", response_model=UserOut)
def me(db: DbSession, citizen: CurrentCitizen):
    user = db.query(User).filter(User.phone == citizen["sub"]).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/me", response_model=UserOut)
def update_me(payload: UpdateProfile, db: DbSession, citizen: CurrentCitizen):
    user = db.query(User).filter(User.phone == citizen["sub"]).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.email:
        clash = db.query(User).filter(User.email == payload.email, User.id != user.id).first()
        if clash:
            raise HTTPException(status_code=409, detail="Email already in use")
    for field in ("name", "email", "city", "avatar_url"):
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)
    if payload.password:
        user.password_hash = hash_password(payload.password)
    db.commit()
    db.refresh(user)
    return user


# --- Admin login ------------------------------------------------------------
admin_router = APIRouter(prefix="/admin", tags=["admin:auth"])


@admin_router.post("/login", response_model=AdminTokenResponse)
def admin_login(payload: AdminLogin, db: DbSession):
    admin = db.query(Admin).filter(Admin.username == payload.username).first()
    if admin is None or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_access_token(
        subject=admin.username,
        role="admin",
        extra={
            "admin_id": admin.id,
            "institution_id": admin.institution_id,
            "institution_type": admin.institution_type,
            "is_superuser": admin.is_superuser,
        },
    )
    return AdminTokenResponse(
        access_token=token,
        username=admin.username,
        full_name=admin.full_name,
        institution_id=admin.institution_id,
        institution_type=admin.institution_type,
        expires_in_days=settings.jwt_expire_days,
    )
