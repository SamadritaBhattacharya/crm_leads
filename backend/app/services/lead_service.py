"""Lead business logic — orchestrates domain rules and repository calls.
Depends only on repository ABCs (Engineering Rules §1), so it's testable
with fake in-memory repositories and zero database (see tests/unit).
"""

from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime

from app.domain.models import (
    Company,
    FinancialYearMonth,
    FinancialYearSummary,
    Lead,
    LeadFilter,
    LeadNote,
    LeadSource,
    LeadStatus,
    LeadUpdate,
    MonthlyRollupSummary,
    PageResult,
    SurveyType,
)
from app.domain.repositories import LeadNoteRepository, LeadRepository
from app.domain.rules import is_honeypot_triggered, is_valid_status_transition

# Hard ceiling on a single CSV export — protects the DB and the response
# stream from an unbounded query; if the CRM ever needs more than this in one
# export, that's a product conversation about pagination/date-scoping the
# export, not a reason to remove the cap.
_MAX_EXPORT_ROWS = 10_000


class LeadNotFoundError(Exception):
    def __init__(self, lead_id: int):
        super().__init__(f"Lead {lead_id} not found")
        self.lead_id = lead_id


class InvalidStatusTransitionError(Exception):
    def __init__(self, current: LeadStatus, new: LeadStatus):
        super().__init__(f"Cannot transition lead from '{current.value}' to '{new.value}'")
        self.current = current
        self.new = new


class LeadService:
    def __init__(self, lead_repo: LeadRepository, lead_note_repo: LeadNoteRepository):
        self._lead_repo = lead_repo
        self._lead_note_repo = lead_note_repo

    async def capture_public_lead(
        self,
        *,
        source: LeadSource,
        first_name: str | None,
        last_name: str | None,
        email: str,
        phone: str | None,
        property_address: str | None,
        property_type: str | None,
        purpose: str | None,
        page_url: str | None,
        ip_address: str | None,
        honeypot: str | None,
    ) -> Lead | None:
        """Handles `POST /api/leads`. Returns None on a honeypot hit — the
        router must still respond as if successful (Engineering Rules §2),
        it just won't have a lead to attach a notification to."""
        if is_honeypot_triggered(honeypot):
            return None

        lead = Lead(
            id=None,
            source=source,
            email=email,
            status=LeadStatus.new,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            property_address=property_address,
            property_type=property_type,
            purpose=purpose,
            page_url=page_url,
            ip_address=ip_address,
        )
        return await self._lead_repo.add(lead)

    async def create_manual_lead(
        self,
        *,
        first_name: str | None,
        last_name: str | None,
        email: str,
        phone: str | None,
        property_address: str | None,
        property_type: str | None,
        purpose: str | None,
        assigned_to: str | None,
        company: Company | None = None,
        amount: float | None = None,
        date_of_valuation: date | None = None,
        file_no: str | None = None,
        survey_type: SurveyType | None = None,
    ) -> Lead:
        """Staff-entered lead — phone call, walk-in, referral. Always
        `LeadSource.manual_entry`, always starts at `new` like any other lead
        so it goes through the same status pipeline and dashboard rollups."""
        lead = Lead(
            id=None,
            source=LeadSource.manual_entry,
            email=email,
            status=LeadStatus.new,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            property_address=property_address,
            property_type=property_type,
            purpose=purpose,
            assigned_to=assigned_to,
            company=company,
            amount=amount,
            date_of_valuation=date_of_valuation,
            file_no=file_no,
            survey_type=survey_type,
        )
        return await self._lead_repo.add(lead)

    async def list_leads(self, filters: LeadFilter) -> PageResult[Lead]:
        return await self._lead_repo.list(filters)

    async def export_leads(self, filters: LeadFilter) -> list[Lead]:
        # `replace` rather than rebuilding field by field: a new column filter
        # must reach the CSV automatically, or the export silently disagrees
        # with the table the user is looking at.
        capped_filters = replace(filters, page=1, page_size=_MAX_EXPORT_ROWS)
        result = await self._lead_repo.list(capped_filters)
        return result.items

    async def get_lead(self, lead_id: int) -> tuple[Lead, list[LeadNote]]:
        lead = await self._lead_repo.get_by_id(lead_id)
        if lead is None:
            raise LeadNotFoundError(lead_id)
        notes = await self._lead_note_repo.list_for_lead(lead_id)
        return lead, notes

    async def update_lead(self, lead_id: int, updates: LeadUpdate) -> Lead:
        current = await self._lead_repo.get_by_id(lead_id)
        if current is None:
            raise LeadNotFoundError(lead_id)
        if updates.status is not None and not is_valid_status_transition(
            current.status, updates.status
        ):
            raise InvalidStatusTransitionError(current.status, updates.status)

        updated = await self._lead_repo.update(lead_id, updates)
        if updated is None:  # pragma: no cover — deleted between get and update (race)
            raise LeadNotFoundError(lead_id)
        return updated

    async def add_note(self, lead_id: int, *, author: str, note: str) -> LeadNote:
        lead = await self._lead_repo.get_by_id(lead_id)
        if lead is None:
            raise LeadNotFoundError(lead_id)
        return await self._lead_note_repo.add(
            LeadNote(id=None, lead_id=lead_id, author=author, note=note)
        )

    async def delete_lead(self, lead_id: int) -> None:
        deleted = await self._lead_repo.delete(lead_id)
        if not deleted:
            raise LeadNotFoundError(lead_id)

    async def monthly_rollup(self, month: date) -> MonthlyRollupSummary:
        rows = await self._lead_repo.monthly_rollup(month)

        by_property_type: dict[str, int] = {}
        by_purpose: dict[str, int] = {}
        by_survey_type: dict[str, int] = {}
        for row in rows:
            pt_key = row.property_type or "Unspecified"
            by_property_type[pt_key] = by_property_type.get(pt_key, 0) + row.total
            purpose_key = row.purpose or "Unspecified"
            by_purpose[purpose_key] = by_purpose.get(purpose_key, 0) + row.total
            survey_key = row.survey_type or "Unspecified"
            by_survey_type[survey_key] = by_survey_type.get(survey_key, 0) + row.total

        return MonthlyRollupSummary(
            total_valuations=sum(row.total for row in rows),
            completed_inspections=sum(row.converted_count for row in rows),
            by_property_type=by_property_type,
            by_purpose=by_purpose,
            by_survey_type=by_survey_type,
        )

    async def financial_year_rollup(self, fy_start_year: int) -> FinancialYearSummary:
        """July→June rollup. `fy_start_year` 2025 = FY 2025–26, i.e. the twelve
        months from 1 July 2025 to 30 June 2026 inclusive."""
        start = date(fy_start_year, 7, 1)
        end = date(fy_start_year + 1, 7, 1)
        rows = await self._lead_repo.rollup_range(start, end)

        # Seeded with all twelve months so a quiet month renders as a gap in
        # the chart rather than shortening the axis.
        months = [
            date(fy_start_year + (0 if m >= 7 else 1), m, 1)
            for m in [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
        ]
        totals = {month: 0 for month in months}
        converted = {month: 0 for month in months}

        by_property_type: dict[str, int] = {}
        by_purpose: dict[str, int] = {}
        by_survey_type: dict[str, int] = {}
        for row in rows:
            # The materialized view's `month` column is TIMESTAMPTZ — coerce
            # to a date so the dict membership check below (`if bucket not
            # in totals`) sees the same keys the seeded `totals` dict uses
            # (built from Python `date` objects). Without this, every row
            # silently misses its bucket and the year rolls up empty.
            if isinstance(row.month, datetime):
                bucket = row.month.date().replace(day=1)
            else:
                bucket = row.month.replace(day=1)
            # A row outside the window can only mean the view and this range
            # query disagree; drop it rather than inventing a 13th month.
            if bucket not in totals:
                continue
            totals[bucket] += row.total
            converted[bucket] += row.converted_count

            pt_key = row.property_type or "Unspecified"
            by_property_type[pt_key] = by_property_type.get(pt_key, 0) + row.total
            purpose_key = row.purpose or "Unspecified"
            by_purpose[purpose_key] = by_purpose.get(purpose_key, 0) + row.total
            survey_key = row.survey_type or "Unspecified"
            by_survey_type[survey_key] = by_survey_type.get(survey_key, 0) + row.total

        total_valuations = sum(totals.values())
        completed_inspections = sum(converted.values())
        busiest = max(totals.items(), key=lambda item: item[1], default=(None, 0))

        return FinancialYearSummary(
            fy_start_year=fy_start_year,
            total_valuations=total_valuations,
            completed_inspections=completed_inspections,
            conversion_rate=(
                round(completed_inspections / total_valuations * 100, 1)
                if total_valuations
                else 0.0
            ),
            busiest_month=busiest[0] if busiest[1] else None,
            by_month=[
                FinancialYearMonth(month=m, total=totals[m], converted=converted[m])
                for m in months
            ],
            by_property_type=by_property_type,
            by_purpose=by_purpose,
            by_survey_type=by_survey_type,
        )
