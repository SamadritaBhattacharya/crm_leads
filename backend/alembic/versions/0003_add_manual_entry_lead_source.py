"""Add `manual_entry` to the lead_source enum.

Additive enum change (Engineering Rules §1/§4, OCP) for staff manually adding
a lead from the CRM (phone call, walk-in, referral) — does not touch any of
the five existing values that are part of the external site's public
contract (Tech Spec §4.1).

Revision ID: 0003_add_manual_entry_lead_source
Revises: 0002_alter_publication_realtime
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0003_manual_entry_src"
down_revision: Union[str, None] = "0002_alter_publication_realtime"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside the transaction Alembic
    # normally wraps a migration in (the new value can't be used in the same
    # transaction that created it) — autocommit_block() sidesteps that.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'manual_entry';")


def downgrade() -> None:
    # Postgres has no ALTER TYPE ... DROP VALUE. Removing an enum value
    # requires a two-phase migration (Engineering Rules §4: create a new type
    # without the value, migrate rows, swap, drop the old type). Not
    # implemented here — no v1 requirement ever needs this reversed, and a
    # fake downgrade would silently risk data loss instead of failing loudly.
    pass
