import pytest

from app.domain.models import LeadStatus
from app.domain.rules import is_honeypot_triggered, is_valid_status_transition


@pytest.mark.parametrize(
    "current,new,expected",
    [
        (LeadStatus.new, LeadStatus.contacted, True),
        (LeadStatus.new, LeadStatus.qualified, False),
        (LeadStatus.new, LeadStatus.converted, False),
        (LeadStatus.new, LeadStatus.lost, False),
        (LeadStatus.contacted, LeadStatus.qualified, True),
        (LeadStatus.contacted, LeadStatus.lost, True),
        (LeadStatus.contacted, LeadStatus.converted, False),
        (LeadStatus.contacted, LeadStatus.new, False),
        (LeadStatus.qualified, LeadStatus.converted, True),
        (LeadStatus.qualified, LeadStatus.lost, True),
        (LeadStatus.qualified, LeadStatus.contacted, False),
        (LeadStatus.converted, LeadStatus.lost, False),
        (LeadStatus.lost, LeadStatus.contacted, False),
        (LeadStatus.new, LeadStatus.new, True),  # no-op update is allowed
    ],
)
def test_is_valid_status_transition(current: LeadStatus, new: LeadStatus, expected: bool) -> None:
    assert is_valid_status_transition(current, new) is expected


@pytest.mark.parametrize(
    "honeypot,expected",
    [
        (None, False),
        ("", False),
        ("   ", False),
        ("bot-filled-this", True),
    ],
)
def test_is_honeypot_triggered(honeypot: str | None, expected: bool) -> None:
    assert is_honeypot_triggered(honeypot) is expected
