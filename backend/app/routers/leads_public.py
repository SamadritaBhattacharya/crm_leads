"""POST /api/leads — public, unauthenticated, rate-limited. This is the
entire integration surface with the external, separately-maintained
lead-capture site (Tech Spec §4.1). Treat every request as adversarial by
default (Engineering Rules §0.3): server-side validation only, honeypot
check before persistence, rate limiting before the DB write.
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Request, Response, status

from app.config import get_settings
from app.dependencies import LeadServiceDep, NotificationServiceDep
from app.schemas.lead import LeadCreate, LeadCreateResponse
from app.security.rate_limit import limiter

settings = get_settings()

router = APIRouter(prefix="/api/leads", tags=["leads-public"])


@router.post("", response_model=LeadCreateResponse)
@limiter.limit(f"{settings.rate_limit_leads_per_minute}/minute")
async def create_lead(
    request: Request,
    response: Response,
    payload: LeadCreate,
    background_tasks: BackgroundTasks,
    lead_service: LeadServiceDep,
    notification_service: NotificationServiceDep,
) -> LeadCreateResponse:
    lead = await lead_service.capture_public_lead(
        source=payload.source,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        property_address=payload.property_address,
        property_type=payload.property_type,
        purpose=payload.purpose,
        page_url=payload.page_url,
        ip_address=request.client.host if request.client else None,
        honeypot=payload.honeypot,
    )

    if lead is None:
        # Honeypot triggered — respond as if successful, never reveal the trap
        # (Engineering Rules §2). 200, not 201: nothing was actually created.
        response.status_code = status.HTTP_200_OK
        return LeadCreateResponse(success=True, lead_id=None)

    background_tasks.add_task(notification_service.send_new_lead_email, lead)
    response.status_code = status.HTTP_201_CREATED
    return LeadCreateResponse(success=True, lead_id=lead.id)
