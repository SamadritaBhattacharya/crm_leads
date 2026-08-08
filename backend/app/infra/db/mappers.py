"""ORM <-> domain dataclass conversion. Keeps `infra/repositories/*` from
leaking SQLAlchemy model instances past this layer — services and routers
only ever see `domain/models.py` types.
"""

from __future__ import annotations

from app.domain.models import AdminRole, AdminUser, Lead, LeadNote
from app.infra.db.orm_models import AdminUserORM, LeadNoteORM, LeadORM


def lead_to_domain(orm: LeadORM) -> Lead:
    return Lead(
        id=orm.id,
        source=orm.source,
        email=orm.email,
        status=orm.status,
        first_name=orm.first_name,
        last_name=orm.last_name,
        phone=orm.phone,
        property_address=orm.property_address,
        property_type=orm.property_type,
        purpose=orm.purpose,
        assigned_to=orm.assigned_to,
        page_url=orm.page_url,
        ip_address=orm.ip_address,
        created_at=orm.created_at,
        updated_at=orm.updated_at,
        company=orm.company,
        amount=float(orm.amount) if orm.amount is not None else None,
        date_of_valuation=orm.date_of_valuation,
        file_no=orm.file_no,
        survey_type=orm.survey_type,
    )


def lead_note_to_domain(orm: LeadNoteORM) -> LeadNote:
    return LeadNote(
        id=orm.id,
        lead_id=orm.lead_id,
        author=orm.author,
        note=orm.note,
        created_at=orm.created_at,
    )


def admin_user_to_domain(orm: AdminUserORM) -> AdminUser:
    return AdminUser(
        id=orm.id,
        username=orm.username,
        email=orm.email,
        hashed_password=orm.hashed_password,
        role=AdminRole(orm.role),
        full_name=orm.full_name or "",
        created_at=orm.created_at,
    )
