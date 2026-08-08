"""Authenticated CRUD surface for staff (Tech Spec §4) plus the dashboard
rollup endpoint. Every route here sits behind the FastAPI JWT trust boundary
(`get_current_user`, applied router-wide) — `DELETE` additionally requires
the admin role (Tech Spec §4.7).

This file intentionally contains two `APIRouter`s: `router` for
`/api/leads/*` and `dashboard_router` for `/api/dashboard/*`, matching the
file listed in the project's folder structure (CLAUDE.md) without inventing
a new module for one endpoint.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterator
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse

from app.dependencies import LeadServiceDep
from app.domain.models import (
    Company,
    CompareOperator,
    Lead,
    LeadFilter,
    LeadSource,
    LeadStatus,
    SortOrder,
    SurveyType,
)
from app.domain.models import LeadUpdate as LeadUpdateDomain
from app.schemas.dashboard import (
    DashboardMonthlyOut,
    DashboardYearlyOut,
    FinancialYearMonthOut,
    PropertyTypeCount,
    PurposeCount,
    SurveyTypeCount,
)
from app.schemas.lead import (
    LeadManualCreate,
    LeadNoteCreate,
    LeadNoteOut,
    LeadOut,
    LeadOutWithNotes,
    LeadUpdate,
    PaginatedLeadsOut,
)
from app.security.deps import CurrentUser, get_current_user, require_admin
from app.services.lead_service import InvalidStatusTransitionError, LeadNotFoundError

router = APIRouter(
    prefix="/api/leads", tags=["leads-admin"], dependencies=[Depends(get_current_user)]
)
dashboard_router = APIRouter(
    prefix="/api/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)]
)

_CSV_COLUMNS = (
    "id", "source", "first_name", "last_name", "email", "phone", "property_address",
    "property_type", "purpose", "status", "assigned_to", "created_at", "updated_at",
    "company", "amount", "date_of_valuation", "file_no", "survey_type",
)


def _lead_out(lead: Lead) -> LeadOut:
    return LeadOut.model_validate(lead, from_attributes=True)


def _lead_filter(
    *,
    status_: list[LeadStatus] | None,
    source: list[LeadSource] | None,
    date_from: date | None,
    date_to: date | None,
    assigned_to: list[str] | None,
    search: str | None,
    survey_type: list[SurveyType] | None = None,
    company: list[Company] | None = None,
    property_type: list[str] | None = None,
    purpose: list[str] | None = None,
    file_no: str | None = None,
    amount_op: CompareOperator | None = None,
    amount_value: float | None = None,
    sort: str | None = None,
    order: SortOrder = SortOrder.desc,
    page: int = 1,
    page_size: int = 25,
) -> LeadFilter:
    return LeadFilter(
        status=status_, source=source, date_from=date_from, date_to=date_to,
        assigned_to=assigned_to, search=search, survey_type=survey_type,
        company=company, property_type=property_type, purpose=purpose,
        file_no=file_no, amount_op=amount_op, amount_value=amount_value,
        sort=sort, order=order, page=page, page_size=page_size,
    )


# The table's column filters are multi-select, so these arrive repeated
# (`?status=new&status=lost`); a single value still parses to a one-item list.
_COLUMN_FILTER_DOC = "Repeatable — one value per selected option."


@router.get("", response_model=PaginatedLeadsOut)
async def list_leads(
    lead_service: LeadServiceDep,
    status_: list[LeadStatus] | None = Query(None, alias="status", description=_COLUMN_FILTER_DOC),
    source: list[LeadSource] | None = Query(None, description=_COLUMN_FILTER_DOC),
    date_from: date | None = None,
    date_to: date | None = None,
    assigned_to: list[str] | None = Query(None, description=_COLUMN_FILTER_DOC),
    search: str | None = None,
    survey_type: list[SurveyType] | None = Query(None, description=_COLUMN_FILTER_DOC),
    company: list[Company] | None = Query(None, description=_COLUMN_FILTER_DOC),
    property_type: list[str] | None = Query(None, description=_COLUMN_FILTER_DOC),
    purpose: list[str] | None = Query(None, description=_COLUMN_FILTER_DOC),
    file_no: str | None = None,
    amount_op: CompareOperator | None = None,
    amount_value: float | None = None,
    sort: str | None = None,
    order: SortOrder = SortOrder.desc,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
) -> PaginatedLeadsOut:
    result = await lead_service.list_leads(
        _lead_filter(
            status_=status_, source=source, date_from=date_from, date_to=date_to,
            assigned_to=assigned_to, search=search, survey_type=survey_type,
            company=company, property_type=property_type, purpose=purpose,
            file_no=file_no, amount_op=amount_op, amount_value=amount_value,
            sort=sort, order=order, page=page, page_size=page_size,
        )
    )
    return PaginatedLeadsOut(
        items=[_lead_out(item) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.get("/export")
async def export_leads(
    lead_service: LeadServiceDep,
    status_: list[LeadStatus] | None = Query(None, alias="status", description=_COLUMN_FILTER_DOC),
    source: list[LeadSource] | None = Query(None, description=_COLUMN_FILTER_DOC),
    date_from: date | None = None,
    date_to: date | None = None,
    assigned_to: list[str] | None = Query(None, description=_COLUMN_FILTER_DOC),
    search: str | None = None,
    survey_type: list[SurveyType] | None = Query(None, description=_COLUMN_FILTER_DOC),
    company: list[Company] | None = Query(None, description=_COLUMN_FILTER_DOC),
    property_type: list[str] | None = Query(None, description=_COLUMN_FILTER_DOC),
    purpose: list[str] | None = Query(None, description=_COLUMN_FILTER_DOC),
    file_no: str | None = None,
    amount_op: CompareOperator | None = None,
    amount_value: float | None = None,
) -> StreamingResponse:
    leads = await lead_service.export_leads(
        _lead_filter(
            status_=status_, source=source, date_from=date_from, date_to=date_to,
            assigned_to=assigned_to, search=search, survey_type=survey_type,
            company=company, property_type=property_type, purpose=purpose,
            file_no=file_no, amount_op=amount_op, amount_value=amount_value,
        )
    )

    def generate_csv() -> Iterator[str]:
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(_CSV_COLUMNS)
        yield buffer.getvalue()
        for lead in leads:
            buffer.seek(0)
            buffer.truncate(0)
            writer.writerow(
                [
                    lead.id, lead.source.value, lead.first_name, lead.last_name, lead.email,
                    lead.phone, lead.property_address, lead.property_type, lead.purpose,
                    lead.status.value, lead.assigned_to, lead.created_at, lead.updated_at,
                    lead.company.value if lead.company else None, lead.amount,
                    lead.date_of_valuation, lead.file_no,
                    lead.survey_type.value if lead.survey_type else None,
                ]
            )
            yield buffer.getvalue()

    return StreamingResponse(
        generate_csv(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )


@router.post("/manual", status_code=status.HTTP_201_CREATED, response_model=LeadOut)
async def create_manual_lead(
    payload: LeadManualCreate,
    lead_service: LeadServiceDep,
    current_user: CurrentUser = Depends(get_current_user),
) -> LeadOut:
    lead = await lead_service.create_manual_lead(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        property_address=payload.property_address,
        property_type=payload.property_type,
        purpose=payload.purpose,
        assigned_to=payload.assigned_to or current_user.username,
        company=payload.company,
        amount=payload.amount,
        date_of_valuation=payload.date_of_valuation,
        file_no=payload.file_no,
        survey_type=payload.survey_type,
    )
    return _lead_out(lead)


@router.get("/{lead_id}", response_model=LeadOutWithNotes)
async def get_lead(lead_id: int, lead_service: LeadServiceDep) -> LeadOutWithNotes:
    try:
        lead, notes = await lead_service.get_lead(lead_id)
    except LeadNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found") from exc
    return LeadOutWithNotes(
        **_lead_out(lead).model_dump(),
        notes=[LeadNoteOut.model_validate(note, from_attributes=True) for note in notes],
    )


@router.patch("/{lead_id}", response_model=LeadOut)
async def update_lead(lead_id: int, payload: LeadUpdate, lead_service: LeadServiceDep) -> LeadOut:
    try:
        lead = await lead_service.update_lead(
            lead_id, LeadUpdateDomain(**payload.model_dump())
        )
    except LeadNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found") from exc
    except InvalidStatusTransitionError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _lead_out(lead)


@router.post("/{lead_id}/notes", status_code=status.HTTP_201_CREATED, response_model=LeadNoteOut)
async def add_note(
    lead_id: int, payload: LeadNoteCreate, lead_service: LeadServiceDep
) -> LeadNoteOut:
    try:
        note = await lead_service.add_note(lead_id, author=payload.author, note=payload.note)
    except LeadNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found") from exc
    return LeadNoteOut.model_validate(note, from_attributes=True)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def delete_lead(lead_id: int, lead_service: LeadServiceDep) -> None:
    try:
        await lead_service.delete_lead(lead_id)
    except LeadNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found") from exc


@dashboard_router.get("/monthly", response_model=DashboardMonthlyOut)
async def dashboard_monthly(
    lead_service: LeadServiceDep,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$", description="YYYY-MM"),
) -> DashboardMonthlyOut:
    month_start = datetime.strptime(month, "%Y-%m").date().replace(day=1)
    summary = await lead_service.monthly_rollup(month_start)
    return DashboardMonthlyOut(
        total_valuations=summary.total_valuations,
        completed_inspections=summary.completed_inspections,
        by_property_type=[
            PropertyTypeCount(type=key, count=value)
            for key, value in summary.by_property_type.items()
        ],
        by_purpose=[
            PurposeCount(purpose=key, count=value) for key, value in summary.by_purpose.items()
        ],
        by_survey_type=[
            SurveyTypeCount(survey_type=key, count=value)
            for key, value in summary.by_survey_type.items()
        ],
    )


@dashboard_router.get("/yearly", response_model=DashboardYearlyOut)
async def dashboard_yearly(
    lead_service: LeadServiceDep,
    fy: int = Query(
        ...,
        ge=2000,
        le=2100,
        description="Financial year start (July). 2025 = FY 2025–26.",
    ),
) -> DashboardYearlyOut:
    summary = await lead_service.financial_year_rollup(fy)
    return DashboardYearlyOut(
        fy_start_year=summary.fy_start_year,
        fy_label=f"FY {summary.fy_start_year}–{str(summary.fy_start_year + 1)[-2:]}",
        total_valuations=summary.total_valuations,
        completed_inspections=summary.completed_inspections,
        conversion_rate=summary.conversion_rate,
        busiest_month=(
            summary.busiest_month.strftime("%b %Y") if summary.busiest_month else None
        ),
        by_month=[
            FinancialYearMonthOut(
                month=bucket.month.strftime("%Y-%m"),
                label=bucket.month.strftime("%b %y"),
                total=bucket.total,
                converted=bucket.converted,
            )
            for bucket in summary.by_month
        ],
        by_property_type=[
            PropertyTypeCount(type=key, count=value)
            for key, value in summary.by_property_type.items()
        ],
        by_purpose=[
            PurposeCount(purpose=key, count=value) for key, value in summary.by_purpose.items()
        ],
        by_survey_type=[
            SurveyTypeCount(survey_type=key, count=value)
            for key, value in summary.by_survey_type.items()
        ],
    )
