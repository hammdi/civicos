"""Create all tables and seed demo data — idempotent and safe to run on boot.

Run with:  python -m app.seeds.seed

Seeds (per the spec):
  * 10 institutions across 3 cities
  * 5 admin accounts (one per institution type) + 1 superadmin
  * document types & issue categories
  * 20 active queue tickets (today, mixed statuses)
  * 15 document files in various statuses
  * 30 market listings across categories
  * 25 urban issues with status updates and upvotes
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.refs import new_reference
from app.core.security import hash_password
from app.models import Base
from app.models.admin import Admin
from app.models.documents import DocumentType, File, FileUpdate
from app.models.issues import Issue, IssueCategory, IssueUpdate, Upvote
from app.models.market import Listing, Order, Review, Seller
from app.models.queue import Institution, Queue, QueueWindow, Ticket
from app.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("civicos.seed")

rng = random.Random(42)  # deterministic seed for repeatable demo data

COUNTRY = "Tunisia"
CITIES = ["Tunis", "Sfax", "Sousse"]
NEIGHBORHOODS = {
    "Tunis": ["Medina", "Lafayette", "El Menzah", "Bab Bhar"],
    "Sfax": ["Centre Ville", "Sakiet Ezzit", "El Bustan"],
    "Sousse": ["Khezama", "Sahloul", "Medina"],
}

DEFAULT_PASSWORD = "civicos123"

# A primary demo citizen whose dashboard is pre-populated with data.
DEMO_USER_PHONE = "+21655000001"
DEMO_USER_PASSWORD = "demo1234"

# (phone, name, email, city, password?)
DEMO_USERS = [
    (DEMO_USER_PHONE, "Amine Ben Salah", "amine@example.com", "Tunis", DEMO_USER_PASSWORD),
    ("+21655000002", "Fatma Trabelsi", "fatma@example.com", "Sfax", None),
    ("+21655000003", "Youssef Gharbi", "youssef@example.com", "Sousse", None),
    ("+21655000004", "Ines Khelifi", "ines@example.com", "Tunis", "demo1234"),
    ("+21655000005", "Walid Mansour", None, "Sfax", None),
]


def avatar_for(name: str) -> str:
    seed = (name or "Citizen").replace(" ", "+")
    return f"https://api.dicebear.com/7.x/initials/svg?seed={seed}&backgroundColor=1B4F72"


_MARKET_IMG_KW = {
    "food": "food,market",
    "clothing": "clothing,fashion",
    "electronics": "electronics,gadget",
    "furniture": "furniture,interior",
    "services": "service,work",
    "crafts": "handicraft,pottery",
    "other": "product",
}
_ISSUE_IMG_KW = {
    "Pothole": "pothole,road",
    "Street Lighting": "streetlight,lamp",
    "Garbage Collection": "garbage,trash",
    "Water Leak": "water,pipe",
    "Damaged Road Sign": "road,sign",
    "Illegal Dumping": "trash,dump",
    "Blocked Drain": "drain,gutter",
    "Broken Sidewalk": "sidewalk,pavement",
}


def market_photo(category: str, i: int) -> str:
    # LoremFlickr serves real Creative-Commons photos by keyword; `lock` makes
    # each one deterministic. The frontend degrades gracefully if it's offline.
    kw = _MARKET_IMG_KW.get(category, "product")
    return f"https://loremflickr.com/640/480/{kw}?lock={i + 100}"


def issue_photo(category_name: str, i: int) -> str:
    kw = _ISSUE_IMG_KW.get(category_name, "city,street")
    return f"https://loremflickr.com/640/480/{kw}?lock={i + 500}"

# (name, type, city, avg_wait_minutes)
INSTITUTIONS = [
    ("Charles Nicolle Hospital", "hospital", "Tunis", 18),
    ("Tunis City Hall", "municipality", "Tunis", 9),
    ("Tunis Central Post", "post", "Tunis", 6),
    ("Tunis First Instance Court", "court", "Tunis", 25),
    ("Tunis Tax Office", "tax_office", "Tunis", 14),
    ("Habib Bourguiba Hospital", "hospital", "Sfax", 16),
    ("Sfax Municipality", "municipality", "Sfax", 11),
    ("Sfax Post Office", "post", "Sousse", 7),
    ("Sousse Municipality", "municipality", "Sousse", 10),
    ("Sousse Tax Office", "tax_office", "Sousse", 13),
]

DOCUMENT_TYPES = [
    ("National ID Card", "municipality", ["Birth certificate", "2 photos", "Old ID (if renewal)"], 10),
    ("Passport", "municipality", ["National ID copy", "2 biometric photos", "Stamp fee receipt"], 21),
    ("Birth Certificate", "municipality", ["Family book", "ID copy"], 3),
    ("Residence Certificate", "municipality", ["ID copy", "Proof of address"], 2),
    ("Criminal Record Extract (B3)", "court", ["ID copy", "Stamp fee receipt"], 5),
    ("Tax Clearance Certificate", "tax_office", ["Tax ID", "Last declaration copy"], 7),
    ("Parcel Collection Slip", "post", ["ID copy", "Tracking number"], 1),
]

ISSUE_CATEGORIES = [
    ("Pothole", "🕳️", "Roads & Infrastructure"),
    ("Street Lighting", "💡", "Public Lighting"),
    ("Garbage Collection", "🗑️", "Sanitation"),
    ("Water Leak", "💧", "Water & Sewage"),
    ("Damaged Road Sign", "🚧", "Roads & Infrastructure"),
    ("Illegal Dumping", "♻️", "Sanitation"),
    ("Blocked Drain", "🌊", "Water & Sewage"),
    ("Broken Sidewalk", "🚶", "Roads & Infrastructure"),
]

MARKET_ITEMS = [
    ("food", ["Homemade Olive Oil 5L", "Fresh Dates 1kg", "Organic Honey Jar", "Harissa Paste", "Sun-dried Tomatoes"]),
    ("clothing", ["Handwoven Wool Jacket", "Traditional Jebba", "Leather Sandals", "Kids Winter Coat", "Silk Scarf"]),
    ("electronics", ["Used Laptop i5", "Smartphone 128GB", "Bluetooth Speaker", "LED TV 32\"", "Gaming Headset"]),
    ("furniture", ["Solid Wood Table", "Office Chair", "Olive Wood Shelf", "Vintage Sofa", "Bookcase"]),
    ("services", ["Math Tutoring", "Home Plumbing", "Car Detailing", "Wedding Photography", "AC Repair"]),
    ("crafts", ["Hand-painted Ceramic Plate", "Woven Basket", "Pottery Vase", "Embroidered Cushion", "Copper Tray"]),
]

ISSUE_TITLES = [
    "Large pothole on Avenue Habib Bourguiba",
    "Street light out near the school",
    "Garbage not collected for a week",
    "Water leaking from main pipe",
    "Stop sign knocked down at intersection",
    "Illegal dumping behind the market",
    "Drain blocked, street flooding when it rains",
    "Sidewalk broken, dangerous for pedestrians",
    "Traffic light stuck on red",
    "Abandoned car blocking the road",
]


def already_seeded(db: Session) -> bool:
    return db.query(Institution).count() > 0


def seed_institutions(db: Session) -> list[Institution]:
    institutions = []
    for name, type_, city, wait in INSTITUTIONS:
        inst = Institution(
            name=name,
            type=type_,
            city=city,
            country=COUNTRY,
            address=f"{rng.randint(1, 120)} Rue de la République, {city}",
            avg_wait_minutes=wait,
            is_active=True,
        )
        db.add(inst)
        institutions.append(inst)
    db.flush()
    logger.info("Seeded %d institutions", len(institutions))
    return institutions


def seed_admins(db: Session, institutions: list[Institution]) -> None:
    by_type: dict[str, Institution] = {}
    for inst in institutions:
        by_type.setdefault(inst.type, inst)

    accounts = [
        ("admin_hospital", "Dr. Amira Hospital Admin", "hospital"),
        ("admin_municipality", "Karim Municipality Admin", "municipality"),
        ("admin_post", "Sonia Post Admin", "post"),
        ("admin_court", "Mehdi Court Admin", "court"),
        ("admin_tax", "Leila Tax Admin", "tax_office"),
    ]
    for username, full_name, type_ in accounts:
        inst = by_type.get(type_)
        db.add(
            Admin(
                username=username,
                password_hash=hash_password(DEFAULT_PASSWORD),
                full_name=full_name,
                institution_id=inst.id if inst else None,
                institution_type=type_,
                is_superuser=False,
            )
        )
    # A convenience superadmin who can operate any institution.
    db.add(
        Admin(
            username="superadmin",
            password_hash=hash_password(DEFAULT_PASSWORD),
            full_name="CivicOS Super Admin",
            institution_id=None,
            institution_type=None,
            is_superuser=True,
        )
    )
    db.flush()
    logger.info("Seeded 5 institution admins + 1 superadmin (password: %s)", DEFAULT_PASSWORD)


def seed_users(db: Session) -> None:
    for phone, name, email, city, password in DEMO_USERS:
        db.add(
            User(
                phone=phone,
                name=name,
                email=email,
                city=city,
                password_hash=hash_password(password) if password else None,
                avatar_url=avatar_for(name),
                is_verified=True,
            )
        )
    db.flush()
    logger.info(
        "Seeded %d demo citizen users (primary: %s / password %s)",
        len(DEMO_USERS),
        DEMO_USER_PHONE,
        DEMO_USER_PASSWORD,
    )


def seed_document_types(db: Session, institutions: list[Institution]) -> list[DocumentType]:
    by_type: dict[str, Institution] = {}
    for inst in institutions:
        by_type.setdefault(inst.type, inst)
    doc_types = []
    for name, inst_type, required, days in DOCUMENT_TYPES:
        inst = by_type.get(inst_type)
        dt = DocumentType(
            name=name,
            institution_id=inst.id if inst else None,
            required_documents=required,
            avg_processing_days=days,
        )
        db.add(dt)
        doc_types.append(dt)
    db.flush()
    logger.info("Seeded %d document types", len(doc_types))
    return doc_types


def seed_queues_and_tickets(db: Session, institutions: list[Institution]) -> None:
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    statuses_pool = (
        ["waiting"] * 12 + ["served"] * 4 + ["called"] * 1 + ["no_show"] * 1 + ["cancelled"] * 2
    )
    total_tickets = 0
    # Open queues for the first 4 institutions and fill them with tickets.
    for inst in institutions[:4]:
        queue = Queue(
            institution_id=inst.id,
            date=today,
            status="open",
            current_number=0,
            total_served=0,
            opened_at=now - timedelta(hours=2),
        )
        db.add(queue)
        db.flush()
        for n in range(1, 6):
            db.add(
                QueueWindow(
                    queue_id=queue.id,
                    window_number=n,
                    agent_name=f"Agent {n}",
                )
            )
        n_tickets = 5  # ~20 tickets across 4 queues
        for i in range(1, n_tickets + 1):
            status = statuses_pool[(total_tickets) % len(statuses_pool)]
            created = now - timedelta(minutes=rng.randint(5, 120))
            # Give the primary demo user a live ticket in the first two queues.
            phone = DEMO_USER_PHONE if (i == 2 and inst.id <= 2) else f"+2165{rng.randint(1000000, 9999999)}"
            ticket = Ticket(
                queue_id=queue.id,
                number=i,
                phone=phone,
                service_type=rng.choice(["general", "renewal", "payment", "info"]),
                status=status,
                created_at=created,
            )
            if status == "served":
                ticket.called_at = created + timedelta(minutes=rng.randint(5, 30))
                ticket.served_at = ticket.called_at + timedelta(minutes=rng.randint(2, 15))
                ticket.wait_minutes = int((ticket.served_at - created).total_seconds() / 60)
                queue.total_served += 1
                queue.current_number = max(queue.current_number, i)
            elif status == "called":
                ticket.called_at = now - timedelta(minutes=2)
                queue.current_number = max(queue.current_number, i)
            db.add(ticket)
            total_tickets += 1
        db.flush()
    logger.info("Seeded %d queue tickets across 4 open queues", total_tickets)


def seed_files(db: Session, doc_types: list[DocumentType]) -> None:
    statuses = ["submitted", "processing", "ready", "delivered", "rejected"]
    messages = {
        "submitted": "File request submitted",
        "processing": "Documents under review",
        "ready": "Ready for pickup at the counter",
        "delivered": "Handed to the citizen",
        "rejected": "Missing required documents",
    }
    now = datetime.now(timezone.utc)
    for i in range(15):
        dt = rng.choice(doc_types)
        status = statuses[i % len(statuses)]
        submitted = now - timedelta(days=rng.randint(0, 20))
        ref = new_reference("REF")
        phone = DEMO_USER_PHONE if i in (0, 7) else f"+2165{rng.randint(1000000, 9999999)}"
        file = File(
            reference_number=ref,
            citizen_phone=phone,
            document_type_id=dt.id,
            status=status,
            submitted_at=submitted,
            expected_ready_date=(submitted + timedelta(days=dt.avg_processing_days)).date(),
            notes=rng.choice([None, "Urgent", "Renewal", "First request"]),
        )
        db.add(file)
        db.flush()
        # Build a small status history up to the current status.
        history = statuses[: statuses.index(status) + 1] if status != "rejected" else ["submitted", "processing", "rejected"]
        prev = None
        for j, st in enumerate(history):
            db.add(
                FileUpdate(
                    file_id=file.id,
                    old_status=prev,
                    new_status=st,
                    message=messages[st],
                    updated_by="system" if j == 0 else "admin_municipality",
                    updated_at=submitted + timedelta(days=j),
                )
            )
            prev = st
    logger.info("Seeded 15 document files with histories")


def seed_market(db: Session) -> None:
    sellers = []
    for i in range(10):
        city = rng.choice(CITIES)
        # The first seller is the primary demo user, so their account dashboard
        # shows real listings they can manage.
        if i == 0:
            name, phone, city = "Amine Ben Salah", DEMO_USER_PHONE, "Tunis"
        else:
            name = rng.choice(["Ahmed", "Fatma", "Youssef", "Nadia", "Sami", "Ines", "Walid", "Rania"]) + f" {chr(65 + i)}."
            phone = f"+2165{rng.randint(1000000, 9999999)}"
        seller = Seller(
            name=name,
            phone=phone,
            city=city,
            neighborhood=rng.choice(NEIGHBORHOODS[city]),
            verified=i == 0 or rng.random() > 0.5,
            rating=round(rng.uniform(3.5, 5.0), 1),
            total_sales=rng.randint(0, 40),
        )
        db.add(seller)
        sellers.append(seller)
    db.flush()

    listing_count = 0
    listings = []
    for category, titles in MARKET_ITEMS:
        for title in titles:  # 5 each × 6 categories = 30 listings
            # Ensure the demo seller (sellers[0]) owns the first few listings.
            seller = sellers[0] if listing_count < 3 else rng.choice(sellers)
            listing = Listing(
                seller_id=seller.id,
                title=title,
                description=f"{title} — good condition, available in {seller.city}. Contact for details.",
                category=category,
                price=round(rng.uniform(5, 800), 2),
                negotiable=rng.random() > 0.3,
                photos=[market_photo(category, listing_count)],
                city=seller.city,
                neighborhood=seller.neighborhood,
                status=rng.choice(["active", "active", "active", "sold"]),
                views=rng.randint(0, 500),
            )
            db.add(listing)
            listings.append(listing)
            listing_count += 1
    db.flush()

    # A few orders and reviews to make profiles realistic.
    for listing in rng.sample(listings, 12):
        db.add(
            Order(
                listing_id=listing.id,
                buyer_phone=f"+2165{rng.randint(1000000, 9999999)}",
                buyer_name=rng.choice(["Mohamed", "Sarra", "Hatem", "Olfa"]),
                message="Is this still available? Can you do a better price?",
                status=rng.choice(["pending", "accepted", "completed"]),
            )
        )
    for listing in rng.sample(listings, 18):
        db.add(
            Review(
                listing_id=listing.id,
                reviewer_phone=f"+2165{rng.randint(1000000, 9999999)}",
                rating=rng.randint(3, 5),
                comment=rng.choice(["Great seller!", "As described.", "Fast response.", "Recommended."]),
            )
        )
    logger.info("Seeded %d market listings, sellers, orders and reviews", listing_count)


def seed_issues(db: Session, categories: list[IssueCategory]) -> None:
    statuses = ["reported", "acknowledged", "in_progress", "resolved", "closed"]
    priorities = ["low", "medium", "high", "urgent"]
    # Rough coordinates per city for the map view.
    coords = {
        "Tunis": (36.8065, 10.1815),
        "Sfax": (34.7406, 10.7603),
        "Sousse": (35.8254, 10.6360),
    }
    now = datetime.now(timezone.utc)
    for i in range(25):
        city = rng.choice(CITIES)
        base_lat, base_lng = coords[city]
        category = rng.choice(categories)
        status = statuses[i % len(statuses)]
        created = now - timedelta(days=rng.randint(0, 30))
        ref = new_reference("ISS")
        phone = DEMO_USER_PHONE if i in (1, 4, 9) else f"+2165{rng.randint(1000000, 9999999)}"
        issue = Issue(
            reference_number=ref,
            reporter_phone=phone,
            category_id=category.id,
            title=rng.choice(ISSUE_TITLES),
            description="Reported by a citizen. Needs municipal attention.",
            location_lat=round(base_lat + rng.uniform(-0.04, 0.04), 6),
            location_lng=round(base_lng + rng.uniform(-0.04, 0.04), 6),
            address=f"{rng.choice(NEIGHBORHOODS[city])}, {city}",
            city=city,
            photos=[issue_photo(category.name, i)],
            status=status,
            priority=rng.choice(priorities),
            assigned_dept=category.responsible_dept if status != "reported" else None,
            created_at=created,
        )
        if status in ("resolved", "closed"):
            issue.resolved_at = created + timedelta(days=rng.randint(1, 10))
            issue.resolution_note = "Fixed by the responsible department."
        db.add(issue)
        db.flush()

        # Status history.
        history = statuses[: statuses.index(status) + 1]
        for j, st in enumerate(history):
            db.add(
                IssueUpdate(
                    issue_id=issue.id,
                    status=st,
                    message=f"Status moved to {st}",
                    updated_by="system" if j == 0 else "admin_municipality",
                    updated_at=created + timedelta(days=j),
                )
            )
        # Some upvotes.
        n_up = rng.randint(0, 15)
        seen_phones = set()
        for _ in range(n_up):
            phone = f"+2165{rng.randint(1000000, 9999999)}"
            if phone in seen_phones:
                continue
            seen_phones.add(phone)
            db.add(Upvote(issue_id=issue.id, voter_phone=phone))
        issue.upvote_count = len(seen_phones)
    logger.info("Seeded 25 urban issues with updates and upvotes")


def run() -> None:
    logger.info("Ensuring database schema exists...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if already_seeded(db):
            logger.info("Database already seeded — skipping.")
            return
        logger.info("Seeding demo data...")
        institutions = seed_institutions(db)
        seed_admins(db, institutions)
        seed_users(db)
        doc_types = seed_document_types(db, institutions)
        categories = [
            IssueCategory(name=n, icon=icon, responsible_dept=dept)
            for n, icon, dept in ISSUE_CATEGORIES
        ]
        db.add_all(categories)
        db.flush()
        seed_queues_and_tickets(db, institutions)
        seed_files(db, doc_types)
        seed_market(db)
        seed_issues(db, categories)
        db.commit()
        logger.info("✅ Seeding complete.")
    except Exception:
        db.rollback()
        logger.exception("Seeding failed; rolled back.")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
