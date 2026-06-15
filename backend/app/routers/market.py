"""Module 3 — Local Market. Browse, sell, contact and review."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_

from app.core.deps import CurrentCitizen, DbSession
from app.core.notifications import send_sms
from app.models.market import Listing, Order, Review, Seller
from app.schemas.common import Message
from app.schemas.market import (
    ContactSellerRequest,
    ListingCreate,
    ListingDetail,
    ListingOut,
    ListingUpdate,
    OrderOut,
    ReviewCreate,
    ReviewOut,
    SellerProfile,
)

router = APIRouter(tags=["market"])


def _get_or_create_seller(db: DbSession, phone: str, name: str | None, city: str, neighborhood: str | None) -> Seller:
    seller = db.query(Seller).filter(Seller.phone == phone).first()
    if seller is None:
        seller = Seller(
            name=name or "Seller",
            phone=phone,
            city=city,
            neighborhood=neighborhood,
        )
        db.add(seller)
        db.flush()
    return seller


def _listing_detail(db: DbSession, listing: Listing) -> ListingDetail:
    stats = (
        db.query(func.count(Review.id), func.coalesce(func.avg(Review.rating), 0.0))
        .filter(Review.listing_id == listing.id)
        .one()
    )
    detail = ListingDetail.model_validate(listing)
    detail.seller = listing.seller  # type: ignore[assignment]
    detail.review_count = int(stats[0])
    detail.avg_rating = round(float(stats[1]), 2)
    return detail


# --- Browse -----------------------------------------------------------------
@router.get("/listings", response_model=list[ListingOut])
def browse_listings(
    db: DbSession,
    q: str | None = Query(None, description="Search title/description"),
    city: str | None = None,
    category: str | None = None,
    neighborhood: str | None = None,
    status_filter: str = Query("active", alias="status"),
    min_price: float | None = None,
    max_price: float | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
):
    query = db.query(Listing)
    if status_filter:
        query = query.filter(Listing.status == status_filter)
    if city:
        query = query.filter(Listing.city.ilike(f"%{city}%"))
    if neighborhood:
        query = query.filter(Listing.neighborhood.ilike(f"%{neighborhood}%"))
    if category:
        query = query.filter(Listing.category == category)
    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Listing.title.ilike(like), Listing.description.ilike(like)))
    return query.order_by(Listing.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/listings/{listing_id}", response_model=ListingDetail)
def listing_detail(listing_id: int, db: DbSession):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    listing.views += 1
    db.commit()
    db.refresh(listing)
    return _listing_detail(db, listing)


# --- Sell (phone OTP gated) -------------------------------------------------
@router.post("/listings", response_model=ListingDetail, status_code=status.HTTP_201_CREATED)
def create_listing(payload: ListingCreate, db: DbSession, citizen: CurrentCitizen):
    phone = citizen["sub"]
    seller = _get_or_create_seller(db, phone, payload.seller_name, payload.city, payload.neighborhood)
    listing = Listing(
        seller_id=seller.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        price=payload.price,
        negotiable=payload.negotiable,
        photos=payload.photos,
        city=payload.city,
        neighborhood=payload.neighborhood,
        status="active",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _listing_detail(db, listing)


def _require_owner(db: DbSession, listing_id: int, phone: str) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.seller.phone != phone:
        raise HTTPException(status_code=403, detail="You can only manage your own listings")
    return listing


@router.put("/listings/{listing_id}", response_model=ListingDetail)
def update_listing(listing_id: int, payload: ListingUpdate, db: DbSession, citizen: CurrentCitizen):
    listing = _require_owner(db, listing_id, citizen["sub"])
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(listing, field, value)
    db.commit()
    db.refresh(listing)
    return _listing_detail(db, listing)


@router.delete("/listings/{listing_id}", response_model=Message)
def delete_listing(listing_id: int, db: DbSession, citizen: CurrentCitizen):
    listing = _require_owner(db, listing_id, citizen["sub"])
    db.delete(listing)
    db.commit()
    return Message(message="Listing deleted")


# --- Contact & reviews ------------------------------------------------------
@router.post("/listings/{listing_id}/contact", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def contact_seller(listing_id: int, payload: ContactSellerRequest, db: DbSession):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    order = Order(
        listing_id=listing.id,
        buyer_phone=payload.buyer_phone,
        buyer_name=payload.buyer_name,
        message=payload.message,
        status="pending",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    # Notify the seller of the new interest.
    send_sms(
        listing.seller.phone,
        f"CivicOS Market — {payload.buyer_name or payload.buyer_phone} is interested in '{listing.title}': {payload.message}",
        db,
    )
    return order


@router.post("/listings/{listing_id}/review", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def leave_review(listing_id: int, payload: ReviewCreate, db: DbSession):
    listing = db.get(Listing, listing_id)
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    review = Review(
        listing_id=listing.id,
        reviewer_phone=payload.reviewer_phone,
        rating=payload.rating,
        comment=payload.comment,
    )
    db.add(review)
    db.flush()

    # Recompute the seller's aggregate rating across all their listings.
    seller = listing.seller
    avg = (
        db.query(func.coalesce(func.avg(Review.rating), 0.0))
        .join(Listing, Review.listing_id == Listing.id)
        .filter(Listing.seller_id == seller.id)
        .scalar()
    )
    seller.rating = round(float(avg or 0.0), 2)
    db.commit()
    db.refresh(review)
    return review


@router.get("/sellers/{phone}", response_model=SellerProfile)
def seller_profile(phone: str, db: DbSession):
    seller = db.query(Seller).filter(Seller.phone == phone).first()
    if seller is None:
        raise HTTPException(status_code=404, detail="Seller not found")
    profile = SellerProfile.model_validate(seller)
    profile.listings = [ListingOut.model_validate(l) for l in seller.listings]  # noqa: E741
    return profile
