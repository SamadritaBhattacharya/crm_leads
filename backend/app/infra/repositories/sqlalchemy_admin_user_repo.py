from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import AdminUser, AdminRole
from app.domain.repositories import AdminUserRepository
from app.infra.db.mappers import admin_user_to_domain
from app.infra.db.orm_models import AdminUserORM


class SQLAlchemyAdminUserRepository(AdminUserRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def get_by_username(self, username: str) -> AdminUser | None:
        stmt = select(AdminUserORM).where(AdminUserORM.username == username)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return admin_user_to_domain(orm) if orm is not None else None

    async def get_by_email(self, email: str) -> AdminUser | None:
        stmt = select(AdminUserORM).where(AdminUserORM.email == email)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        return admin_user_to_domain(orm) if orm is not None else None

    async def add(self, user: AdminUser) -> AdminUser:
        orm = AdminUserORM(
            username=user.username,
            email=user.email,
            hashed_password=user.hashed_password,
            role=user.role.value,
            full_name=user.full_name or "",
        )
        self._session.add(orm)
        await self._session.flush()
        return admin_user_to_domain(orm)

    async def update_full_name(self, username: str, full_name: str) -> None:
        stmt = select(AdminUserORM).where(AdminUserORM.username == username)
        orm = (await self._session.execute(stmt)).scalar_one_or_none()
        if orm is None:
            return
        orm.full_name = full_name
        await self._session.flush()
