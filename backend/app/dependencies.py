"""FastAPI `Depends` wiring — the one place concrete `infra/repositories/*`
classes get constructed and injected into services (Engineering Rules §1).
Routers depend on the service factories below, never on repositories directly.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infra.db.session import get_db
from app.infra.repositories.sqlalchemy_admin_user_repo import SQLAlchemyAdminUserRepository
from app.infra.repositories.sqlalchemy_lead_note_repo import SQLAlchemyLeadNoteRepository
from app.infra.repositories.sqlalchemy_lead_repo import SQLAlchemyLeadRepository
from app.services.auth_service import AuthService
from app.services.firebase_auth_service import FirebaseAuthService
from app.services.lead_service import LeadService
from app.services.notification_service import NotificationService

DbSession = Annotated[AsyncSession, Depends(get_db)]

# Process-wide singleton: stateless, config-only, no per-request resources.
_notification_service = NotificationService()


def get_lead_service(db: DbSession) -> LeadService:
    return LeadService(
        lead_repo=SQLAlchemyLeadRepository(db),
        lead_note_repo=SQLAlchemyLeadNoteRepository(db),
    )


def get_auth_service(db: DbSession) -> AuthService:
    return AuthService(admin_user_repo=SQLAlchemyAdminUserRepository(db))


def get_notification_service() -> NotificationService:
    return _notification_service


def get_firebase_auth_service(db: DbSession) -> FirebaseAuthService:
    return FirebaseAuthService(admin_user_repo=SQLAlchemyAdminUserRepository(db))


LeadServiceDep = Annotated[LeadService, Depends(get_lead_service)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
FirebaseAuthServiceDep = Annotated[FirebaseAuthService, Depends(get_firebase_auth_service)]
NotificationServiceDep = Annotated[NotificationService, Depends(get_notification_service)]
