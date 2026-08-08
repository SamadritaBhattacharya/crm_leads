"""Add full_name to admin_users for the staff profile display.

Additive per Engineering Rules §1 (OCP). The frontend sidebar shows the
logged-in user's first name once they sign in — this column is the source
of truth. Empty string is allowed: legacy users bootstrapped before this
migration won't have a name (they keep working, the sidebar just falls
back to their username).

Revision ID: 0005_admin_full_name
Revises: 0004_valuation_fields
Create Date: 2026-07-22
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0006_admin_full_name"
down_revision: Union[str, None] = "0005_survey_type_rollup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "admin_users",
        sa.Column("full_name", sa.String(255), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("admin_users", "full_name")
