"""Import every model module so ``Base.metadata`` knows the full schema.

Anything that calls ``Base.metadata.create_all`` (seeding, tests) only needs to
``import app.models`` for all tables to be registered.
"""

from app.models.base import Base  # noqa: F401
from app.models.admin import Admin  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.queue import Institution, Queue, Ticket, QueueWindow  # noqa: F401
from app.models.documents import (  # noqa: F401
    DocumentType,
    File,
    FileUpdate,
    NotificationLog,
)
from app.models.market import Seller, Listing, Order, Review  # noqa: F401
from app.models.issues import IssueCategory, Issue, IssueUpdate, Upvote  # noqa: F401

__all__ = [
    "Base",
    "Admin",
    "User",
    "Institution",
    "Queue",
    "Ticket",
    "QueueWindow",
    "DocumentType",
    "File",
    "FileUpdate",
    "NotificationLog",
    "Seller",
    "Listing",
    "Order",
    "Review",
    "IssueCategory",
    "Issue",
    "IssueUpdate",
    "Upvote",
]
