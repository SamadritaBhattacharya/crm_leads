"""In-memory fake repositories implementing the domain ABCs — this is what
makes `services/` unit-testable with zero database (CLAUDE.md testing bar).
"""

from __future__ import annotations

from dataclasses import fields
from datetime import date, datetime, timezone

from app.domain.models import (
    AdminUser,
    Lead,
    LeadFilter,
    LeadNote,
    LeadUpdate,
    MonthlyRollupRow,
    PageResult,
)
from app.domain.repositories import AdminUserRepository, LeadNoteRepository, LeadRepository


class FakeLeadRepository(LeadRepository):
    def __init__(self) -> None:
        self._leads: dict[int, Lead] = {}
        self._next_id = 1
        self.rollup_rows: list[MonthlyRollupRow] = []

    async def add(self, lead: Lead) -> Lead:
        lead.id = self._next_id
        lead.created_at = datetime.now(timezone.utc)
        lead.updated_at = lead.created_at
        self._leads[lead.id] = lead
        self._next_id += 1
        return lead

    async def get_by_id(self, lead_id: int) -> Lead | None:
        return self._leads.get(lead_id)

    async def list(self, filters: LeadFilter) -> PageResult[Lead]:
        items = list(self._leads.values())
        if filters.status is not None:
            items = [lead for lead in items if lead.status == filters.status]
        if filters.source is not None:
            items = [lead for lead in items if lead.source == filters.source]
        if filters.assigned_to is not None:
            items = [lead for lead in items if lead.assigned_to == filters.assigned_to]
        start = (filters.page - 1) * filters.page_size
        page_items = items[start : start + filters.page_size]
        return PageResult(items=page_items, total=len(items), page=filters.page, page_size=filters.page_size)

    async def update(self, lead_id: int, updates: LeadUpdate) -> Lead | None:
        lead = self._leads.get(lead_id)
        if lead is None:
            return None
        for field in fields(updates):
            value = getattr(updates, field.name)
            if value is not None:
                setattr(lead, field.name, value)
        return lead

    async def delete(self, lead_id: int) -> bool:
        return self._leads.pop(lead_id, None) is not None

    async def monthly_rollup(self, month: date) -> list[MonthlyRollupRow]:
        return self.rollup_rows

    async def rollup_range(self, start: date, end: date) -> list[MonthlyRollupRow]:
        return [row for row in self.rollup_rows if start <= row.month < end]


class FakeLeadNoteRepository(LeadNoteRepository):
    def __init__(self) -> None:
        self._notes: list[LeadNote] = []
        self._next_id = 1

    async def add(self, note: LeadNote) -> LeadNote:
        note.id = self._next_id
        note.created_at = datetime.now(timezone.utc)
        self._next_id += 1
        self._notes.append(note)
        return note

    async def list_for_lead(self, lead_id: int) -> list[LeadNote]:
        return [note for note in self._notes if note.lead_id == lead_id]


class FakeAdminUserRepository(AdminUserRepository):
    def __init__(self, users: list[AdminUser] | None = None) -> None:
        self._users = {user.username: user for user in (users or [])}

    async def get_by_username(self, username: str) -> AdminUser | None:
        return self._users.get(username)
