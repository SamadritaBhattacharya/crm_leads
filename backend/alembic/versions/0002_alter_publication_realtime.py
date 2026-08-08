"""Add `leads` to the Supabase Realtime publication.

Kept as its own migration, separate from the initial schema (Engineering
Rules §4): this is Supabase-specific DDL with no ORM equivalent, and without
it Supabase's WAL listener will never emit change events for `leads` — the
entire live-dashboard mechanism (System Architecture §1) silently does
nothing without this statement having run.

Revision ID: 0002_alter_publication_realtime
Revises: 0001_initial_schema
Create Date: 2026-07-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0002_alter_publication_realtime"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER PUBLICATION supabase_realtime ADD TABLE leads;")


def downgrade() -> None:
    op.execute("ALTER PUBLICATION supabase_realtime DROP TABLE leads;")
