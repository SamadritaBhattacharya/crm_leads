from __future__ import annotations

from dataclasses import fields
from datetime import date, datetime, timezone

from sqlalchemy import ColumnElement, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    CompareOperator,
    Lead,
    LeadFilter,
    LeadUpdate,
    MonthlyRollupRow,
    PageResult,
    SortOrder,
)
from app.domain.repositories import LeadRepository
from app.infra.db.mappers import lead_to_domain
from app.infra.db.orm_models import LeadORM

# Operator symbol -> SQL comparison, so `_build_conditions` stays a flat list
# of conditions instead of a nested match statement.
_AMOUNT_COMPARISONS = {
    CompareOperator.gt: lambda column, value: column > value,
    CompareOperator.lt: lambda column, value: column < value,
    CompareOperator.eq: lambda column, value: column == value,
    CompareOperator.gte: lambda column, value: column >= value,
    CompareOperator.lte: lambda column, value: column <= value,
}

# Column-id (matches the frontend TanStack column ids) -> ORM column the table
# is allowed to sort on. An allowlist, so a request-supplied sort key can never
# reach the SQL as an arbitrary attribute.
_SORTABLE_COLUMNS = {
    "created_at": LeadORM.created_at,
    "first_name": LeadORM.first_name,
    "last_name": LeadORM.last_name,
    "email": LeadORM.email,
    "source": LeadORM.source,
    "property_type": LeadORM.property_type,
    "purpose": LeadORM.purpose,
    "company": LeadORM.company,
    "survey_type": LeadORM.survey_type,
    "file_no": LeadORM.file_no,
    "date_of_valuation": LeadORM.date_of_valuation,
    "amount": LeadORM.amount,
    "status": LeadORM.status,
    "assigned_to": LeadORM.assigned_to,
}


class SQLAlchemyLeadRepository(LeadRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def add(self, lead: Lead) -> Lead:
        orm = LeadORM(
            source=lead.source,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=lead.email,
            phone=lead.phone,
            property_address=lead.property_address,
            property_type=lead.property_type,
            purpose=lead.purpose,
            status=lead.status,
            assigned_to=lead.assigned_to,
            page_url=lead.page_url,
            ip_address=lead.ip_address,
            company=lead.company,
            amount=lead.amount,
            date_of_valuation=lead.date_of_valuation,
            file_no=lead.file_no,
            survey_type=lead.survey_type,
        )
        self._session.add(orm)
        await self._session.commit()
        await self._session.refresh(orm)
        return lead_to_domain(orm)

    async def get_by_id(self, lead_id: int) -> Lead | None:
        orm = await self._session.get(LeadORM, lead_id)
        return lead_to_domain(orm) if orm is not None else None

    async def list(self, filters: LeadFilter) -> PageResult[Lead]:
        conditions = self._build_conditions(filters)

        count_stmt = select(func.count()).select_from(LeadORM)
        for condition in conditions:
            count_stmt = count_stmt.where(condition)
        total = (await self._session.execute(count_stmt)).scalar_one()

        stmt = select(LeadORM)
        for condition in conditions:
            stmt = stmt.where(condition)
        stmt = (
            stmt.order_by(*self._order_by(filters))
            .offset((filters.page - 1) * filters.page_size)
            .limit(filters.page_size)
        )
        rows = (await self._session.execute(stmt)).scalars().all()

        return PageResult(
            items=[lead_to_domain(row) for row in rows],
            total=total,
            page=filters.page,
            page_size=filters.page_size,
        )

    async def update(self, lead_id: int, updates: LeadUpdate) -> Lead | None:
        orm = await self._session.get(LeadORM, lead_id)
        if orm is None:
            return None
        # LeadUpdate's field names mirror LeadORM's column names 1:1 (both
        # ultimately describe Tech Spec §5's LeadUpdate) — only fields the
        # caller actually set (non-None) are applied.
        for field in fields(updates):
            value = getattr(updates, field.name)
            if value is not None:
                setattr(orm, field.name, value)
        await self._session.commit()
        await self._session.refresh(orm)
        return lead_to_domain(orm)

    async def delete(self, lead_id: int) -> bool:
        orm = await self._session.get(LeadORM, lead_id)
        if orm is None:
            return False
        await self._session.delete(orm)
        await self._session.commit()
        return True

    async def monthly_rollup(self, month: date) -> list[MonthlyRollupRow]:
        # Reads the materialized view (Tech Spec §3), not the leads table
        # directly — trigger-refreshed on every write per the Open Decision
        # #3 recommendation, so this never drifts from the source of truth.
        #
        # The view's `month` column is `TIMESTAMPTZ` (it's the result of
        # `date_trunc('month', created_at)` on a TIMESTAMPTZ). Passing a
        # Python `date` here binds it as DATE, which makes `month = :month`
        # an always-false cross-type compare against TIMESTAMPTZ. Bind the
        # anchor as a UTC midnight `datetime` so Postgres sees the matching
        # type. Avoid `:month::timestamptz` — asyncpg's text(DBAPI) layer
        # treats the cast suffix as part of the parameter name and chokes
        # with "syntax error at or near ':'".
        anchor = datetime(month.year, month.month, 1, tzinfo=timezone.utc)
        result = await self._session.execute(
            text(
                """
                SELECT month, property_type, purpose, survey_type, total, converted_count
                FROM mv_monthly_rollup
                WHERE month = :anchor
                """
            ),
            {"anchor": anchor},
        )
        return [
            MonthlyRollupRow(
                month=row.month,
                property_type=row.property_type,
                purpose=row.purpose,
                survey_type=row.survey_type,
                total=row.total,
                converted_count=row.converted_count,
            )
            for row in result
        ]

    async def rollup_range(self, start: date, end: date) -> list[MonthlyRollupRow]:
        # Same materialized view as monthly_rollup, single query for the
        # whole financial year. Same TIMESTAMPTZ-binding fix: anchor the
        # bound parameters as UTC midnights on the 1st.
        start_anchor = datetime(start.year, start.month, start.day, tzinfo=timezone.utc)
        end_anchor = datetime(end.year, end.month, end.day, tzinfo=timezone.utc)
        result = await self._session.execute(
            text(
                """
                SELECT month, property_type, purpose, survey_type, total, converted_count
                FROM mv_monthly_rollup
                WHERE month >= :start AND month < :end
                ORDER BY month
                """
            ),
            {"start": start_anchor, "end": end_anchor},
        )
        return [
            MonthlyRollupRow(
                month=row.month,
                property_type=row.property_type,
                purpose=row.purpose,
                survey_type=row.survey_type,
                total=row.total,
                converted_count=row.converted_count,
            )
            for row in result
        ]

    @staticmethod
    def _order_by(filters: LeadFilter) -> list[ColumnElement]:
        # Allowlist the sortable columns rather than getattr'ing the field name
        # straight off the ORM — a request-supplied string must never reach the
        # SQL, and only the columns the table actually offers a sort on belong
        # here. `id` is appended as a stable tiebreaker so equal keys page
        # deterministically instead of shuffling between requests.
        column = _SORTABLE_COLUMNS.get(filters.sort or "")
        if column is None:
            return [LeadORM.created_at.desc(), LeadORM.id.desc()]
        direction = column.asc() if filters.order is SortOrder.asc else column.desc()
        return [direction, LeadORM.id.desc()]

    @staticmethod
    def _build_conditions(filters: LeadFilter) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = []
        # Multi-select column filters — an empty list means "no filter", not
        # "match nothing", so these test truthiness rather than `is not None`.
        if filters.status:
            conditions.append(LeadORM.status.in_(filters.status))
        if filters.source:
            conditions.append(LeadORM.source.in_(filters.source))
        if filters.date_from is not None:
            conditions.append(LeadORM.created_at >= filters.date_from)
        if filters.date_to is not None:
            conditions.append(LeadORM.created_at < filters.date_to)
        if filters.assigned_to:
            conditions.append(LeadORM.assigned_to.in_(filters.assigned_to))
        if filters.survey_type:
            conditions.append(LeadORM.survey_type.in_(filters.survey_type))
        if filters.company:
            conditions.append(LeadORM.company.in_(filters.company))
        if filters.property_type:
            conditions.append(LeadORM.property_type.in_(filters.property_type))
        if filters.purpose:
            conditions.append(LeadORM.purpose.in_(filters.purpose))
        if filters.file_no:
            conditions.append(LeadORM.file_no.ilike(f"%{filters.file_no}%"))
        if filters.amount_op is not None and filters.amount_value is not None:
            conditions.append(
                _AMOUNT_COMPARISONS[filters.amount_op](LeadORM.amount, filters.amount_value)
            )
        if filters.search:
            like = f"%{filters.search}%"
            conditions.append(
                or_(
                    LeadORM.first_name.ilike(like),
                    LeadORM.last_name.ilike(like),
                    LeadORM.email.ilike(like),
                    LeadORM.phone.ilike(like),
                )
            )
        return conditions
