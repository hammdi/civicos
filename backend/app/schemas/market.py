"""Schemas for Module 3 — Local Market."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

Category = Literal[
    "food", "clothing", "electronics", "furniture", "services", "crafts", "other"
]
ListingStatus = Literal["active", "sold", "expired"]
OrderStatus = Literal["pending", "accepted", "rejected", "completed"]


class SellerOut(ORMModel):
    id: int
    name: str
    phone: str
    city: str
    neighborhood: str | None = None
    verified: bool
    rating: float
    total_sales: int


class ListingOut(ORMModel):
    id: int
    seller_id: int
    title: str
    description: str | None = None
    category: str
    price: float
    negotiable: bool
    photos: list[str] = []
    city: str
    neighborhood: str | None = None
    status: str
    views: int
    created_at: datetime


class ListingDetail(ListingOut):
    seller: SellerOut | None = None
    review_count: int = 0
    avg_rating: float = 0.0


class SellerProfile(SellerOut):
    listings: list[ListingOut] = []


# Phone OTP gates creation/update; the caller supplies their own phone (taken
# from the verified citizen token in the router).
class ListingCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    category: Category = "other"
    price: float = Field(0, ge=0)
    negotiable: bool = True
    photos: list[str] = []
    city: str
    neighborhood: str | None = None
    seller_name: str | None = None  # used to create the seller on first listing


class ListingUpdate(BaseModel):
    title: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = None
    category: Category | None = None
    price: float | None = Field(None, ge=0)
    negotiable: bool | None = None
    photos: list[str] | None = None
    status: ListingStatus | None = None


class OrderOut(ORMModel):
    id: int
    listing_id: int
    buyer_phone: str
    buyer_name: str | None = None
    message: str | None = None
    status: str
    created_at: datetime


class ContactSellerRequest(BaseModel):
    buyer_phone: str = Field(..., min_length=5, max_length=32)
    buyer_name: str | None = None
    message: str = Field(..., min_length=1, max_length=2000)


class ReviewOut(ORMModel):
    id: int
    listing_id: int
    reviewer_phone: str
    rating: int
    comment: str | None = None
    created_at: datetime


class ReviewCreate(BaseModel):
    reviewer_phone: str = Field(..., min_length=5, max_length=32)
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = None
