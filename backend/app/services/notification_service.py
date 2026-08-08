"""New-lead email notification. Dispatched via FastAPI `BackgroundTasks`,
never inline in the request path (Engineering Rules §6) — a slow or down SMTP
server must never add latency to `POST /api/leads`, let alone fail the write.
The DB row is the source of truth; this is a courtesy.

`send_new_lead_email` is a plain sync function (not `async def`) on purpose:
`smtplib` is blocking, and FastAPI's `BackgroundTasks` runs sync callables in
a threadpool automatically — an `async def` here would block the event loop
for the duration of the SMTP round-trip instead.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.config import get_settings
from app.domain.models import Lead

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self) -> None:
        self._settings = get_settings()

    def send_new_lead_email(self, lead: Lead) -> None:
        settings = self._settings
        if not settings.smtp_host or not settings.staff_notification_email:
            logger.info("SMTP not configured; skipping new-lead notification for lead_id=%s", lead.id)
            return

        message = EmailMessage()
        message["Subject"] = f"New lead: {lead.source.value}"
        message["From"] = settings.smtp_from_address or settings.staff_notification_email
        message["To"] = settings.staff_notification_email
        message.set_content(
            "New lead received.\n\n"
            f"Name: {(lead.first_name or '')} {(lead.last_name or '')}\n"
            f"Email: {lead.email}\n"
            f"Phone: {lead.phone or 'N/A'}\n"
            f"Source: {lead.source.value}\n"
            f"Property: {lead.property_address or 'N/A'}\n"
        )

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(message)
        except OSError:
            # Notification failures are logged/alerted but never block the lead
            # from being saved (Engineering Rules §6) — the write already happened.
            logger.exception("Failed to send new-lead notification email for lead_id=%s", lead.id)
