"""Pure business rules — zero I/O, unit-testable with zero database
(Engineering Rules §0.4, CLAUDE.md layering). This is what a router or
service delegates to instead of inlining a state machine or a spam check.
"""

from __future__ import annotations

from app.domain.models import LeadStatus

# Valid status transitions (Tech Spec §2). Terminal states (converted, lost)
# have no outgoing edges in v1 — reopening a closed lead is not a specified
# requirement. Adding a transition later is a change to this table only.
_VALID_TRANSITIONS: dict[LeadStatus, frozenset[LeadStatus]] = {
    LeadStatus.new: frozenset({LeadStatus.contacted}),
    LeadStatus.contacted: frozenset({LeadStatus.qualified, LeadStatus.lost}),
    LeadStatus.qualified: frozenset({LeadStatus.converted, LeadStatus.lost}),
    LeadStatus.converted: frozenset(),
    LeadStatus.lost: frozenset(),
}


def is_valid_status_transition(current: LeadStatus, new: LeadStatus) -> bool:
    """True if `current -> new` is an allowed transition, or a no-op (same status,
    e.g. a PATCH that only changes `assigned_to`)."""
    if current == new:
        return True
    return new in _VALID_TRANSITIONS[current]


def is_honeypot_triggered(honeypot: str | None) -> bool:
    """True if the hidden honeypot field was populated — i.e. very likely a bot.
    Callers must respond as if successful while silently dropping the row
    (Engineering Rules §2) — never reveal the trap to the caller.
    """
    return bool(honeypot and honeypot.strip())
