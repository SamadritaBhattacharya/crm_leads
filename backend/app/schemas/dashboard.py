from __future__ import annotations

from pydantic import BaseModel


class PropertyTypeCount(BaseModel):
    type: str
    count: int


class PurposeCount(BaseModel):
    purpose: str
    count: int


class SurveyTypeCount(BaseModel):
    survey_type: str
    count: int


class DashboardMonthlyOut(BaseModel):
    """GET /api/dashboard/monthly response — Tech Spec §4.9."""

    total_valuations: int
    completed_inspections: int
    by_property_type: list[PropertyTypeCount]
    by_purpose: list[PurposeCount]
    by_survey_type: list[SurveyTypeCount]


class FinancialYearMonthOut(BaseModel):
    month: str  # YYYY-MM
    label: str  # "Jul 25" — pre-formatted so the axis matches the FY ordering
    total: int
    converted: int


class DashboardYearlyOut(BaseModel):
    """GET /api/dashboard/yearly response — July→June financial year."""

    fy_start_year: int
    fy_label: str
    total_valuations: int
    completed_inspections: int
    conversion_rate: float
    busiest_month: str | None
    by_month: list[FinancialYearMonthOut]
    by_property_type: list[PropertyTypeCount]
    by_purpose: list[PurposeCount]
    by_survey_type: list[SurveyTypeCount]
