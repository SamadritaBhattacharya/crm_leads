from unittest.mock import patch

from app.domain.models import Lead, LeadSource, LeadStatus
from app.services.notification_service import NotificationService


def _lead() -> Lead:
    return Lead(
        id=1,
        source=LeadSource.residential_valuation,
        email="jane@example.com",
        status=LeadStatus.new,
        first_name="Jane",
        last_name="Smith",
    )


def test_skips_silently_when_smtp_not_configured() -> None:
    service = NotificationService()
    service._settings.smtp_host = None
    service._settings.staff_notification_email = "staff@example.com"

    with patch("smtplib.SMTP") as smtp:
        service.send_new_lead_email(_lead())

    smtp.assert_not_called()


def test_sends_email_when_smtp_configured() -> None:
    service = NotificationService()
    service._settings.smtp_host = "smtp.example.com"
    service._settings.staff_notification_email = "staff@example.com"
    service._settings.smtp_username = None
    service._settings.smtp_password = None
    service._settings.smtp_use_tls = False

    with patch("smtplib.SMTP") as smtp:
        service.send_new_lead_email(_lead())

    smtp.return_value.__enter__.return_value.send_message.assert_called_once()


def test_smtp_failure_never_raises() -> None:
    """The DB write already happened by the time this runs (Engineering Rules
    §6) — a down SMTP server must never surface as an error to the caller."""
    service = NotificationService()
    service._settings.smtp_host = "smtp.example.com"
    service._settings.staff_notification_email = "staff@example.com"

    with patch("smtplib.SMTP", side_effect=OSError("connection refused")):
        service.send_new_lead_email(_lead())  # must not raise
