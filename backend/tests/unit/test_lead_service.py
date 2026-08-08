import pytest

from app.domain.models import LeadFilter, LeadSource, LeadStatus, LeadUpdate, MonthlyRollupRow
from app.services.lead_service import InvalidStatusTransitionError, LeadNotFoundError, LeadService
from tests.unit.fakes import FakeLeadNoteRepository, FakeLeadRepository


@pytest.fixture
def lead_repo() -> FakeLeadRepository:
    return FakeLeadRepository()


@pytest.fixture
def service(lead_repo: FakeLeadRepository) -> LeadService:
    return LeadService(lead_repo, FakeLeadNoteRepository())


async def _make_manual_lead(service: LeadService, **overrides):
    defaults = dict(
        first_name="Bob",
        last_name="Jones",
        email="bob@example.com",
        phone=None,
        property_address=None,
        property_type=None,
        purpose=None,
        assigned_to=None,
    )
    defaults.update(overrides)
    return await service.create_manual_lead(**defaults)


async def test_capture_public_lead_creates_a_row(service: LeadService) -> None:
    lead = await service.capture_public_lead(
        source=LeadSource.residential_valuation,
        first_name="Jane",
        last_name="Smith",
        email="jane@example.com",
        phone=None,
        property_address=None,
        property_type=None,
        purpose=None,
        page_url="https://example.com/residential-valuation",
        ip_address="1.2.3.4",
        honeypot="",
    )
    assert lead is not None
    assert lead.id is not None
    assert lead.status == LeadStatus.new
    assert lead.source == LeadSource.residential_valuation


async def test_capture_public_lead_honeypot_silently_drops(service: LeadService, lead_repo: FakeLeadRepository) -> None:
    lead = await service.capture_public_lead(
        source=LeadSource.residential_valuation,
        first_name=None,
        last_name=None,
        email="bot@example.com",
        phone=None,
        property_address=None,
        property_type=None,
        purpose=None,
        page_url=None,
        ip_address="1.2.3.4",
        honeypot="i-am-a-bot",
    )
    assert lead is None
    result = await lead_repo.list(LeadFilter())
    assert result.total == 0  # no row was created


async def test_manual_lead_always_uses_manual_entry_source(service: LeadService) -> None:
    lead = await _make_manual_lead(service)
    assert lead.source == LeadSource.manual_entry
    assert lead.status == LeadStatus.new


async def test_manual_lead_defaults_assigned_to_none_when_unset(service: LeadService) -> None:
    lead = await _make_manual_lead(service, assigned_to=None)
    assert lead.assigned_to is None


async def test_update_lead_valid_transition_succeeds(service: LeadService) -> None:
    lead = await _make_manual_lead(service)
    updated = await service.update_lead(lead.id, LeadUpdate(status=LeadStatus.contacted))
    assert updated.status == LeadStatus.contacted


async def test_update_lead_invalid_transition_raises(service: LeadService) -> None:
    lead = await _make_manual_lead(service)
    with pytest.raises(InvalidStatusTransitionError):
        await service.update_lead(lead.id, LeadUpdate(status=LeadStatus.converted))


async def test_update_lead_can_reassign_without_changing_status(service: LeadService) -> None:
    lead = await _make_manual_lead(service)
    updated = await service.update_lead(lead.id, LeadUpdate(assigned_to="staff2"))
    assert updated.status == LeadStatus.new
    assert updated.assigned_to == "staff2"


async def test_update_lead_can_set_valuation_fields(service: LeadService) -> None:
    from app.domain.models import Company, SurveyType

    lead = await _make_manual_lead(service)
    updated = await service.update_lead(
        lead.id,
        LeadUpdate(company=Company.app, amount=1500.0, file_no="F-001", survey_type=SurveyType.inspection),
    )
    assert updated.company == Company.app
    assert updated.amount == 1500.0
    assert updated.file_no == "F-001"
    assert updated.survey_type == SurveyType.inspection


async def test_update_missing_lead_raises_not_found(service: LeadService) -> None:
    with pytest.raises(LeadNotFoundError):
        await service.update_lead(999, LeadUpdate(status=LeadStatus.contacted))


async def test_add_note_to_missing_lead_raises_not_found(service: LeadService) -> None:
    with pytest.raises(LeadNotFoundError):
        await service.add_note(999, author="staff1", note="hello")


async def test_add_note_to_existing_lead(service: LeadService) -> None:
    lead = await _make_manual_lead(service)
    note = await service.add_note(lead.id, author="staff1", note="Called, left voicemail")
    assert note.lead_id == lead.id
    assert note.author == "staff1"


async def test_delete_missing_lead_raises_not_found(service: LeadService) -> None:
    with pytest.raises(LeadNotFoundError):
        await service.delete_lead(999)


async def test_delete_existing_lead(service: LeadService, lead_repo: FakeLeadRepository) -> None:
    lead = await _make_manual_lead(service)
    await service.delete_lead(lead.id)
    assert await lead_repo.get_by_id(lead.id) is None


async def test_monthly_rollup_aggregates_across_property_types(
    service: LeadService, lead_repo: FakeLeadRepository
) -> None:
    from datetime import date

    lead_repo.rollup_rows = [
        MonthlyRollupRow(month=date(2026, 7, 1), property_type="Residential", purpose="Sale", survey_type="Inspection", total=10, converted_count=4),
        MonthlyRollupRow(month=date(2026, 7, 1), property_type="Commercial", purpose="Sale", survey_type="Kerbside Valuation", total=5, converted_count=1),
        MonthlyRollupRow(month=date(2026, 7, 1), property_type=None, purpose=None, survey_type=None, total=2, converted_count=0),
    ]
    summary = await service.monthly_rollup(date(2026, 7, 1))
    assert summary.total_valuations == 17
    assert summary.completed_inspections == 5
    assert summary.by_property_type == {"Residential": 10, "Commercial": 5, "Unspecified": 2}
    assert summary.by_purpose == {"Sale": 15, "Unspecified": 2}
    assert summary.by_survey_type == {
        "Inspection": 10,
        "Kerbside Valuation": 5,
        "Unspecified": 2,
    }


async def test_financial_year_rollup_runs_july_to_june(
    service: LeadService, lead_repo: FakeLeadRepository
) -> None:
    from datetime import date

    lead_repo.rollup_rows = [
        # First and last month of FY 2025-26, plus one month outside it.
        MonthlyRollupRow(month=date(2025, 7, 1), property_type="Residential", purpose="Sale", survey_type="Inspection", total=6, converted_count=3),
        MonthlyRollupRow(month=date(2026, 6, 1), property_type="Commercial", purpose="Sale", survey_type="Inspection", total=4, converted_count=1),
        MonthlyRollupRow(month=date(2025, 6, 1), property_type="Residential", purpose="Sale", survey_type="Inspection", total=99, converted_count=99),
    ]
    summary = await service.financial_year_rollup(2025)

    assert [bucket.month for bucket in summary.by_month][:2] == [date(2025, 7, 1), date(2025, 8, 1)]
    assert summary.by_month[-1].month == date(2026, 6, 1)
    assert len(summary.by_month) == 12
    # The June 2025 row belongs to the previous FY and must not leak in.
    assert summary.total_valuations == 10
    assert summary.completed_inspections == 4
    assert summary.conversion_rate == 40.0
    assert summary.busiest_month == date(2025, 7, 1)
    assert summary.by_property_type == {"Residential": 6, "Commercial": 4}


async def test_financial_year_rollup_with_no_leads(
    service: LeadService, lead_repo: FakeLeadRepository
) -> None:
    lead_repo.rollup_rows = []
    summary = await service.financial_year_rollup(2025)

    assert len(summary.by_month) == 12
    assert summary.total_valuations == 0
    assert summary.conversion_rate == 0.0
    assert summary.busiest_month is None
