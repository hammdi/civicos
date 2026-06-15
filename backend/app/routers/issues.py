"""Module 4 public API — report, browse, track and upvote urban issues."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from app.core.deps import DbSession
from app.core.refs import new_reference
from app.core.websocket import issues_channel, manager
from app.models.issues import Issue, IssueCategory, IssueUpdate, Upvote
from app.schemas.common import Message
from app.schemas.issues import (
    IssueCategoryOut,
    IssueCreate,
    IssueOut,
    IssueStatsOut,
    IssueWithHistory,
    UpvoteRequest,
)

router = APIRouter(tags=["issues"])


@router.get("/issue-categories", response_model=list[IssueCategoryOut])
def list_categories(db: DbSession):
    return db.query(IssueCategory).order_by(IssueCategory.name.asc()).all()


@router.post("/issues", response_model=IssueWithHistory, status_code=status.HTTP_201_CREATED)
def report_issue(payload: IssueCreate, db: DbSession):
    if payload.category_id is not None and db.get(IssueCategory, payload.category_id) is None:
        raise HTTPException(status_code=404, detail="Category not found")

    reference = new_reference("ISS")
    while db.query(Issue).filter(Issue.reference_number == reference).first() is not None:
        reference = new_reference("ISS")

    issue = Issue(
        reference_number=reference,
        reporter_phone=payload.reporter_phone,
        category_id=payload.category_id,
        title=payload.title,
        description=payload.description,
        location_lat=payload.location_lat,
        location_lng=payload.location_lng,
        address=payload.address,
        city=payload.city,
        photos=payload.photos,
        status="reported",
        priority=payload.priority,
    )
    db.add(issue)
    db.flush()
    db.add(
        IssueUpdate(
            issue_id=issue.id,
            status="reported",
            message="Issue reported by citizen",
            updated_by="system",
        )
    )
    db.commit()
    db.refresh(issue)

    manager.broadcast_sync(
        issues_channel(issue.city),
        {"event": "issue_reported", "reference": issue.reference_number, "city": issue.city},
    )
    return issue


@router.get("/issues", response_model=list[IssueOut])
def browse_issues(
    db: DbSession,
    city: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    category_id: int | None = None,
    priority: str | None = None,
    limit: int = Query(200, le=1000),
    offset: int = 0,
):
    """Returns issues for the map/list view. Each item carries lat/lng so the
    frontend can pin them directly."""
    query = db.query(Issue)
    if city:
        query = query.filter(Issue.city.ilike(f"%{city}%"))
    if status_filter:
        query = query.filter(Issue.status == status_filter)
    if category_id:
        query = query.filter(Issue.category_id == category_id)
    if priority:
        query = query.filter(Issue.priority == priority)
    return query.order_by(Issue.created_at.desc()).offset(offset).limit(limit).all()


@router.get("/issues/stats", response_model=IssueStatsOut)
def issue_stats(db: DbSession, city: str | None = None):
    base = db.query(Issue)
    if city:
        base = base.filter(Issue.city.ilike(f"%{city}%"))

    total = base.count()

    def group(column):
        rows = (
            base.with_entities(column, func.count(Issue.id)).group_by(column).all()
        )
        return {str(k): int(v) for k, v in rows}

    by_status = group(Issue.status)
    by_priority = group(Issue.priority)

    cat_rows = (
        base.join(IssueCategory, isouter=True)
        .with_entities(func.coalesce(IssueCategory.name, "uncategorized"), func.count(Issue.id))
        .group_by(IssueCategory.name)
        .all()
    )
    by_category = {str(k): int(v) for k, v in cat_rows}

    resolved = by_status.get("resolved", 0) + by_status.get("closed", 0)
    resolved_rate = round(resolved / total, 3) if total else 0.0

    # Average resolution time in days for resolved issues.
    resolved_issues = base.filter(Issue.resolved_at.isnot(None)).all()
    if resolved_issues:
        days = [
            (i.resolved_at - i.created_at).total_seconds() / 86400.0
            for i in resolved_issues
            if i.resolved_at and i.created_at
        ]
        avg_days = round(sum(days) / len(days), 2) if days else None
    else:
        avg_days = None

    return IssueStatsOut(
        city=city,
        total=total,
        by_status=by_status,
        by_priority=by_priority,
        by_category=by_category,
        resolved_rate=resolved_rate,
        avg_resolution_days=avg_days,
    )


@router.get("/issues/{reference}", response_model=IssueWithHistory)
def track_issue(reference: str, db: DbSession):
    issue = db.query(Issue).filter(Issue.reference_number == reference).first()
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


@router.post("/issues/{issue_id}/upvote", response_model=Message)
def upvote_issue(issue_id: int, payload: UpvoteRequest, db: DbSession):
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    try:
        db.add(Upvote(issue_id=issue.id, voter_phone=payload.voter_phone))
        issue.upvote_count = (issue.upvote_count or 0) + 1
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You already upvoted this issue")

    manager.broadcast_sync(
        issues_channel(issue.city),
        {"event": "issue_upvoted", "reference": issue.reference_number, "upvotes": issue.upvote_count},
    )
    return Message(message=f"Upvoted. This issue now has {issue.upvote_count} supporters.")
