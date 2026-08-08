"""One-off CLI to bootstrap a staff/admin login.

There's no public signup route by design (CLAUDE.md — no unauthenticated
route other than login exists). The first `admin_users` row has to come from
somewhere outside the API, so this script is that somewhere. Safe to re-run —
it's a no-op if the username already exists.

Usage (from backend/, with the venv active and .env configured):
    python scripts/create_admin_user.py --username admin --email admin@example.com --password "..." --role admin
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.domain.models import AdminRole  # noqa: E402
from app.infra.db.orm_models import AdminUserORM  # noqa: E402
from app.infra.db.session import async_session_maker  # noqa: E402
from app.security.passwords import hash_password  # noqa: E402


async def create_admin_user(*, username: str, email: str, password: str, role: AdminRole) -> None:
    async with async_session_maker() as session:
        existing = await session.execute(
            select(AdminUserORM).where(AdminUserORM.username == username)
        )
        if existing.scalar_one_or_none() is not None:
            print(f"User '{username}' already exists — nothing to do.")
            return

        session.add(
            AdminUserORM(
                username=username,
                email=email,
                hashed_password=hash_password(password),
                role=role.value,
            )
        )
        await session.commit()
        print(f"Created {role.value} user '{username}'.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a staff/admin login for the CRM.")
    parser.add_argument("--username", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", choices=["admin", "staff"], default="staff")
    args = parser.parse_args()

    asyncio.run(
        create_admin_user(
            username=args.username, email=args.email, password=args.password, role=AdminRole(args.role)
        )
    )


if __name__ == "__main__":
    main()
