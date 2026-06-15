"""Auth schemas — citizen accounts (OTP + optional password) and admin login."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


# --- Citizen user profile ---------------------------------------------------
class UserOut(ORMModel):
    id: int
    phone: str
    name: str
    email: str | None = None
    city: str | None = None
    avatar_url: str | None = None
    is_verified: bool
    created_at: datetime


class RegisterRequest(BaseModel):
    phone: str = Field(..., min_length=5, max_length=32, examples=["+21655123456"])
    name: str = Field(..., min_length=2, max_length=160)
    email: EmailStr | None = None
    password: str | None = Field(None, min_length=6, max_length=128)
    city: str | None = None


class OTPRequest(BaseModel):
    phone: str = Field(..., min_length=5, max_length=32, examples=["+21655123456"])


class OTPRequestResponse(BaseModel):
    message: str
    is_new_user: bool = False
    # Present only in development so testers don't have to read server logs.
    debug_otp: str | None = None


class OTPVerify(BaseModel):
    phone: str = Field(..., min_length=5, max_length=32)
    otp: str = Field(..., min_length=4, max_length=8)
    # Optional profile fields applied on first verification (registration flow).
    name: str | None = None
    email: EmailStr | None = None
    city: str | None = None


class PasswordLogin(BaseModel):
    identifier: str = Field(..., description="phone number or email")
    password: str


class UpdateProfile(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=160)
    email: EmailStr | None = None
    city: str | None = None
    avatar_url: str | None = None
    password: str | None = Field(None, min_length=6, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "citizen"
    expires_in_days: int
    user: UserOut


# --- Admin ------------------------------------------------------------------
class AdminLogin(BaseModel):
    username: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "admin"
    username: str
    full_name: str
    institution_id: int | None = None
    institution_type: str | None = None
    expires_in_days: int
