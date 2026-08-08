"""Group `mv_monthly_rollup` by `survey_type` as well.

Additive (Engineering Rules §1, OCP) — the dashboard needs per-survey-type
counts (Inspection / External / Desktop Valuation / Kerbside Valuation)
alongside the existing property_type and purpose breakdowns. `survey_type`
landed on `leads` in 0004 but the view predates it, so the column was invisible
to the rollup endpoint.

A materialized view's column list can't be altered in place, so this drops and
recreates it. The refresh trigger from 0001 references the view only from
inside a plpgsql body (no catalog dependency), so it survives the swap and
keeps firing against the new definition.

Grouping by one more column raises row cardinality but not the totals —
`lead_service.monthly_rollup` sums rows per key, so every existing figure is
unchanged.

Revision ID: 0005_survey_type_rollup
Revises: 0004_valuation_fields
Create Date: 2026-07-22
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0005_survey_type_rollup"
down_revision: Union[str, None] = "0004_valuation_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_monthly_rollup;")
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_monthly_rollup AS
        SELECT
          date_trunc('month', created_at) AS month,
          property_type,
          purpose,
          survey_type,
          count(*) AS total,
          count(*) FILTER (WHERE status = 'converted') AS converted_count
        FROM leads
        GROUP BY 1, 2, 3, 4;
        """
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS mv_monthly_rollup;")
    op.execute(
        """
        CREATE MATERIALIZED VIEW mv_monthly_rollup AS
        SELECT
          date_trunc('month', created_at) AS month,
          property_type,
          purpose,
          count(*) AS total,
          count(*) FILTER (WHERE status = 'converted') AS converted_count
        FROM leads
        GROUP BY 1, 2, 3;
        """
    )
