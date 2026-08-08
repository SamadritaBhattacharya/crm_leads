"""Repository interfaces (ABCs) — the Dependency Inversion boundary.

`services/` depend on these, never on `infra/repositories/*` concrete classes
directly (Engineering Rules §1). Each interface stays narrow (ISP) — a service
that only adds notes never depends on lead-deletion capability it doesn't use.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date

from app.domain.models import (
    AdminUser,
    Lead,
    LeadFilter,
    LeadNote,
    LeadUpdate,
    MonthlyRollupRow,
    PageResult,
)


class LeadRepository(ABC):
    @abstractmethod
    async def add(self, lead: Lead) -> Lead: ...

    @abstractmethod
    async def get_by_id(self, lead_id: int) -> Lead | None: ...

    @abstractmethod
    async def list(self, filters: LeadFilter) -> PageResult[Lead]: ...

    @abstractmethod
    async def update(self, lead_id: int, updates: LeadUpdate) -> Lead | None: ...

    @abstractmethod
    async def delete(self, lead_id: int) -> bool: ...

    @abstractmethod
    async def monthly_rollup(self, month: date) -> list[MonthlyRollupRow]: ...

    @abstractmethod
    async def rollup_range(self, start: date, end: date) -> list[MonthlyRollupRow]:
        """Rollup rows for every month in [start, end) — `end` exclusive."""


class LeadNoteRepository(ABC):
    @abstractmethod
    async def add(self, note: LeadNote) -> LeadNote: ...

    @abstractmethod
    async def list_for_lead(self, lead_id: int) -> list[LeadNote]: ...


class AdminUserRepository(ABC):
    @abstractmethod
    async def get_by_username(self, username: str) -> AdminUser | None: ...

    @abstractmethod
    async def get_by_email(self, email: str) -> AdminUser | None: ...

    @abstractmethod
    async def add(self, user: AdminUser) -> AdminUser: ...

    @abstractmethod
    async def update_full_name(self, username: str, full_name: str) -> None: ...
