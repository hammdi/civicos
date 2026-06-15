"""Module 4 admin API — municipality issue dashboard (JWT protected)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.deps import CurrentAdmin, DbSession
from app.core.notifications import send_sms
from app.core.websocket import issues_channel, manager
from app.models.issues import Issue, IssueCategory, IssueUpdate
from app.schemas.issues import IssueAssign, IssueOut, IssueStatusUpdate, IssueWithHistory

router = APIRouter(prefix="/admin", tags=["admin:issues"])

_STATUS_MESSAGES = {
    "acknowledged": "Your report {ref} has been acknowledged by the municipality.",
    "in_progress": "Your report {ref} is being processed.",
    "resolved": "Your report {ref} has been resolved. Thank you for helping your city.",
    "closed": "Your report {ref} has been closed.",
}


@router.get("/issues", response_model=list[IssueWithHistory])
def admin_list_issues(
    db: DbSession,
    admin: CurrentAdmin,
    city: str | None = None,
    status: str | None = Query(None),
    priority: str | None = None,
    department: str | None = None,
):
    query = db.query(Issue)
    if city:
        query = query.filter(Issue.city.ilike(f"%{city}%"))
    if status:
        query = query.filter(Issue.status == status)
    if priority:
        query = query.filter(Issue.priority == priority)
    if department:
        query = query.filter(Issue.assigned_dept == department)
    return query.order_by(Issue.created_at.desc()).limit(1000).all()


@router.put("/issues/{issue_id}/status", response_model=IssueWithHistory)
def update_issue_status(issue_id: int, payload: IssueStatusUpdate, db: DbSession, admin: CurrentAdmin):
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")

    issue.status = payload.status
    if payload.status in ("resolved", "closed") and issue.resolved_at is None:
        issue.resolved_at = datetime.now(timezone.utc)
        if payload.message:
            issue.resolution_note = payload.message

    db.add(
        IssueUpdate(
            issue_id=issue.id,
            status=payload.status,
            message=payload.message,
            updated_by=admin.get("sub", "admin"),
            photo=payload.photo,
        )
    )
    db.commit()
    db.refresh(issue)

    msg = payload.message or _STATUS_MESSAGES.get(payload.status, "Update on report {ref}.").format(
        ref=issue.reference_number
    )
    send_sms(issue.reporter_phone, msg, db)

    manager.broadcast_sync(
        issues_channel(issue.city),
        {
            "event": "issue_status_changed",
            "reference": issue.reference_number,
            "status": issue.status,
        },
    )
    return issue


@router.post("/issues/{issue_id}/assign", response_model=IssueOut)
def assign_issue(issue_id: int, payload: IssueAssign, db: DbSession, admin: CurrentAdmin):
    issue = db.get(Issue, issue_id)
    if issue is None:
        raise HTTPException(status_code=404, detail="Issue not found")
    issue.assigned_dept = payload.department
    if payload.priority is not None:
        issue.priority = payload.priority
    # Assigning implies the municipality has at least acknowledged it.
    if issue.status == "reported":
        issue.status = "acknowledged"
    db.add(
        IssueUpdate(
            issue_id=issue.id,
            status=issue.status,
            message=f"Assigned to {payload.department}",
            updated_by=admin.get("sub", "admin"),
        )
    )
    db.commit()
    db.refresh(issue)

    manager.broadcast_sync(
        issues_channel(issue.city),
        {"event": "issue_assigned", "reference": issue.reference_number, "department": payload.department},
    )
    return issue
