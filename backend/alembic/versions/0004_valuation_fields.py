"""Add valuation-job fields to `leads` and `google` to the lead_source enum.

Additive (Engineering Rules §1, OCP) — mirrors the frontend's CRM detail/edit
form (lib/schemas/leads.ts), which already carried `company`, `amount`,
`date_of_valuation`, `file_no`, and `survey_type` as mock-only fields with no
backing column. This migration gives them one. `google` joins `lead_source`
the same way `manual_entry` did in 0003 — a new value, none of the five
original public-contract values touched.

Revision ID: 0004_add_lead_valuation_fields
Revises: 0003_add_manual_entry_lead_source
Create Date: 2026-07-21
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0004_valuation_fields"
down_revision: Union[str, None] = "0003_manual_entry_src"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE can't run inside Alembic's normal transaction
    # (same reason as 0003) — autocommit_block() sidesteps that.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE lead_source ADD VALUE IF NOT EXISTS 'google';")

    op.execute("CREATE TYPE company AS ENUM ('APP', 'CPV', 'TAMN');")
    op.execute(
        """
        CREATE TYPE survey_type AS ENUM (
            'Inspection', 'External / Desktop Valuation', 'Kerbside Valuation'
        );
        """
    )

    op.execute(
        """
        ALTER TABLE leads
            ADD COLUMN company company,
            ADD COLUMN amount NUMERIC(12, 2),
            ADD COLUMN date_of_valuation DATE,
            ADD COLUMN file_no VARCHAR(100),
            ADD COLUMN survey_type survey_type;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE leads
            DROP COLUMN IF EXISTS company,
            DROP COLUMN IF EXISTS amount,
            DROP COLUMN IF EXISTS date_of_valuation,
            DROP COLUMN IF EXISTS file_no,
            DROP COLUMN IF EXISTS survey_type;
        """
    )
    op.execute("DROP TYPE IF EXISTS survey_type;")
    op.execute("DROP TYPE IF EXISTS company;")
    # Postgres has no ALTER TYPE ... DROP VALUE — same rationale as 0003's
    # downgrade for not reversing the lead_source addition.
