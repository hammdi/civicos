"""Outbound notifications.

For development every message is printed to the console and persisted to the
`notifications_log` table. A Twilio sender is wired in but lazy: it only
activates when credentials are present, so the platform runs anywhere with
zero external dependencies.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.config import settings

logger = logging.getLogger("civicos.notifications")


def _send_via_twilio(phone: str, message: str) -> str:
    """Returns the delivery status string. Import-guarded so the dependency is
    only required when actually configured."""
    try:
        from twilio.rest import Client  # type: ignore

        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(body=message, from_=settings.twilio_from_number, to=phone)
        return "sent"
    except Exception as exc:  # noqa: BLE001
        logger.error("Twilio send failed for %s: %s", phone, exc)
        return "failed"


def send_sms(phone: str, message: str, db: Session | None = None) -> str:
    """Send an SMS and log it.

    Returns the status: "sent" (twilio) or "logged" (dev console).
    """
    twilio_ready = all(
        [settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number]
    )

    if twilio_ready:
        status = _send_via_twilio(phone, message)
    else:
        # Development default — the spec's console.log notification.
        print(f"[SMS → {phone}] {message}")
        logger.info("SMS (dev) → %s: %s", phone, message)
        status = "logged"

    if db is not None:
        # Imported here to avoid a circular import at module load.
        from app.models.documents import NotificationLog

        db.add(NotificationLog(phone=phone, message=message, status=status))
        db.commit()

    return status
