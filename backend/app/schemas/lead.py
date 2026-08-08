"""Pydantic v2 schemas — Tech Spec §5, verbatim for the public contract.

`LeadCreate` is a versioned public API contract (Engineering Rules §1c): don't
rename/remove/add-required fields without explicit sign-off from whoever owns
the external lead-capture site.
"""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.domain.models import Company, LeadSource, LeadStatus, SurveyType


class LeadCreate(BaseModel):
    """POST /api/leads request body — public, unauthenticated contract."""

    source: LeadSource
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr
    phone: str | None = None
    property_address: str | None = None
    property_type: str | None = None
    purpose: str | None = None
    page_url: str | None = None
    honeypot: str | None = None


class LeadCreateResponse(BaseModel):
    success: bool
    lead_id: int | None


class LeadManualCreate(BaseModel):
    """POST /api/leads/manual request body — JWT-protected, for staff entering
    a lead the CRM didn't receive automatically (phone call, walk-in, referral).
    Always recorded as LeadSource.manual_entry; status always starts at `new`."""

    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr
    phone: str | None = None
    property_address: str | None = None
    property_type: str | None = None
    purpose: str | None = None
    assigned_to: str | None = None
    company: Company | None = None
    amount: float | None = None
    date_of_valuation: date | None = None
    file_no: str | None = None
    survey_type: SurveyType | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: LeadSource
    first_name: str | None
    last_name: str | None
    email: str
    phone: str | None
    property_address: str | None
    property_type: str | None
    purpose: str | None
    status: LeadStatus
    assigned_to: str | None
    created_at: datetime
    updated_at: datetime
    company: Company | None
    amount: float | None
    date_of_valuation: date | None
    file_no: str | None
    survey_type: SurveyType | None


class LeadUpdate(BaseModel):
    status: LeadStatus | None = None
    assigned_to: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
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


class LeadNoteCreate(BaseModel):
    note: str
    author: str


class LeadNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    lead_id: int
    author: str
    note: str
    created_at: datetime


class LeadOutWithNotes(LeadOut):
    notes: list[LeadNoteOut]


class PaginatedLeadsOut(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int
