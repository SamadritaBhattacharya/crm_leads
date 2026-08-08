from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import LeadNote
from app.domain.repositories import LeadNoteRepository
from app.infra.db.mappers import lead_note_to_domain
from app.infra.db.orm_models import LeadNoteORM


class SQLAlchemyLeadNoteRepository(LeadNoteRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, note: LeadNote) -> LeadNote:
        orm = LeadNoteORM(lead_id=note.lead_id, author=note.author, note=note.note)
        self._session.add(orm)
        await self._session.commit()
        await self._session.refresh(orm)
        return lead_note_to_domain(orm)

    async def list_for_lead(self, lead_id: int) -> list[LeadNote]:
        stmt = (
            select(LeadNoteORM)
            .where(LeadNoteORM.lead_id == lead_id)
            .order_by(LeadNoteORM.created_at.asc())
        )
        rows = (await self._session.execute(stmt)).scalars().all()
        return [lead_note_to_domain(row) for row in rows]
