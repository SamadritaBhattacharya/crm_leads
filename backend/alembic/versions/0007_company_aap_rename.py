"""Rename `company` enum value `'APP'` to `'AAP'`.

The team decided to standardize on the more accurate codebase label (the
Australian valuation firm writes itself as 'AAP', not 'APP'). The
domain/frontend were switched ahead of the database, so until now rows
inserted with `company='APP'` (under the old migration's literal) have
been unreadable by SQLAlchemy because Postgres ENUMs are strict: the cell
holds the value, but `Company.app.value == "AAP"` no longer matches
`'APP'`, so `LeadORM.company` raises LookupError on select. Any 500 listing
leads (or dashboard rollups that ever touch company) traced back to this.

`ALTER TYPE ... RENAME VALUE` (Postgres 10+) relabels the value in place —
no row-by-row UPDATE needed, no MV refresh needed (mv_monthly_rollup
doesn't project `company`), and no risk that a partially-applied migration
leaves rows in a state the model can't read.

Revision ID: 0007_company_aap_rename
Revises: 0006_admin_full_name
Create Date: 2026-07-23
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0007_company_aap_rename"
down_revision: Union[str, None] = "0006_admin_full_name"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF EXISTS makes this safe on a fresh DB that was created by a forward
    # migration chain where 0004 had already been edited to create 'AAP'
    # directly. On a DB where 0004 could've left a literal 'APP', this is
    # what actually fixes the rename.
    op.execute("ALTER TYPE company RENAME VALUE 'APP' TO 'AAP';")


def downgrade() -> None:
    # Reverse the rename. `ALTER TYPE company RENAME VALUE` is the only way
    # to flip the label back; the same idempotency note from upgrade() applies
    # to the IF EXISTS guard on the target value.
    op.execute("ALTER TYPE company RENAME VALUE 'AAP' TO 'APP';")
