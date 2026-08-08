"""Domain entities and value objects.

Plain dataclasses only — this module must never import SQLAlchemy, FastAPI,
or asyncpg (Engineering Rules #1, System Architecture #2/DIP). Business logic
in `rules.py` and `services/` depends on these types, never on ORM models.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import Generic, TypeVar


class LeadSource(str, Enum):
    hero_quote_form = "hero_quote_form"
    cta_quote_form = "cta_quote_form"
    residential_valuation = "residential_valuation"
    commercial_valuation = "commercial_valuation"
    rural_valuation = "rural_valuation"
    # Additive per Engineering Rules §1 (OCP) — staff-entered leads that did not
    # originate from one of the external site's forms (phone call, walk-in, referral).
    manual_entry = "manual_entry"
    # Additive per Engineering Rules §1 (OCP) — see alembic/versions/0004_*.
    google = "google"


class LeadStatus(str, Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    converted = "converted"
    lost = "lost"


class AdminRole(str, Enum):
    admin = "admin"
    staff = "staff"


class Company(str, Enum):
    """Valuation firm the lead's job is booked under — additive per
    Engineering Rules §1 (OCP), see alembic/versions/0004_*."""

    app = "AAP"
    cpv = "CPV"
    tamn = "TAMN"


class SurveyType(str, Enum):
    """Site-visit type for the valuation job — additive per Engineering
    Rules §1 (OCP), see alembic/versions/0004_*."""

    inspection = "Inspection"
    external_desktop_valuation = "External / Desktop Valuation"
    kerbside_valuation = "Kerbside Valuation"


@dataclass
class Lead:
    id: int | None
    source: LeadSource
    email: str
    status: LeadStatus = LeadStatus.new
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    property_address: str | None = None
    property_type: str | None = None
    purpose: str | None = None
    assigned_to: str | None = None
    page_url: str | None = None
    ip_address: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Additive per Engineering Rules §1 (OCP) — see alembic/versions/0004_*.
    company: Company | None = None
    amount: float | None = None
    date_of_valuation: date | None = None
    file_no: str | None = None
    survey_type: SurveyType | None = None


@dataclass
class LeadNote:
    id: int | None
    lead_id: int
    author: str
    note: str
    created_at: datetime | None = None


@dataclass
class AdminUser:
    id: int | None
    username: str
    email: str
    hashed_password: str
    role: AdminRole = AdminRole.staff
    full_name: str = ""
    created_at: datetime | None = None


class CompareOperator(str, Enum):
    """Numeric comparison for the table's per-column "compare" filter. The
    values are the operators themselves so the wire format reads literally."""

    gt = ">"
    lt = "<"
    eq = "="
    gte = ">="
    lte = "<="


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


@dataclass
class LeadFilter:
    """Query parameters for LeadRepository.list — a value object so the
    repository interface takes one argument instead of growing new positional
    params every time the CRM table adds a filter.

    The list-valued fields back the table's multi-select column filters; a
    single value on the wire (`?status=new`) still arrives as a one-item list,
    so the existing status tabs and dashboard drill-downs are unaffected."""

    status: list[LeadStatus] | None = None
    source: list[LeadSource] | None = None
    date_from: date | None = None
    date_to: date | None = None
    assigned_to: list[str] | None = None
    search: str | None = None
    survey_type: list[SurveyType] | None = None
    company: list[Company] | None = None
    property_type: list[str] | None = None
    purpose: list[str] | None = None
    file_no: str | None = None
    amount_op: CompareOperator | None = None
    amount_value: float | None = None
    # Column the table is sorted on (an ORM field name); the repository
    # allowlists it, so an unknown value falls back to the default order
    # rather than erroring or opening SQL injection.
    sort: str | None = None
    order: SortOrder = SortOrder.desc
    page: int = 1
    page_size: int = 25


@dataclass
class LeadUpdate:
    """Patch fields for LeadRepository.update — a value object for the same
    reason as LeadFilter above (one argument, not a growing kwarg list).
    Every field is optional-and-unset-by-default; only fields explicitly
    passed by the caller should be applied (Tech Spec §5)."""

    status: LeadStatus | None = None
    assigned_to: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    property_address: str | None = None
    property_type: str | None = None
    purpose: str | None = None
    source: LeadSource | None = None
    company: Company | None = None
    amount: float | None = None
    date_of_valuation: date | None = None
    file_no: str | None = None
    survey_type: SurveyType | None = None


T = TypeVar("T")


@dataclass
class PageResult(Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


@dataclass
class MonthlyRollupRow:
    """One row of `mv_monthly_rollup` (Tech Spec §3) — grouped by
    property_type/purpose/survey_type."""

    month: date
    property_type: str | None
    purpose: str | None
    survey_type: str | None
    total: int
    converted_count: int


@dataclass
class MonthlyRollupSummary:
    """Aggregated shape the dashboard endpoint (Tech Spec §4.9) actually returns."""

    total_valuations: int
    completed_inspections: int
    by_property_type: dict[str, int]
    by_purpose: dict[str, int]
    by_survey_type: dict[str, int]


@dataclass
class FinancialYearMonth:
    """One month of the financial-year series — always present even when the
    month had no leads, so the chart keeps an unbroken July→June axis."""

    month: date
    total: int
    converted: int


@dataclass
class FinancialYearSummary:
    """Aggregated shape of the yearly dashboard endpoint. The Australian
    financial year runs July→June, so `fy_start_year` 2025 means
    July 2025 – June 2026."""

    fy_start_year: int
    total_valuations: int
    completed_inspections: int
    conversion_rate: float
    busiest_month: date | None
    by_month: list[FinancialYearMonth]
    by_property_type: dict[str, int]
    by_purpose: dict[str, int]
    by_survey_type: dict[str, int]
