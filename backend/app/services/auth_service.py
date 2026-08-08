from __future__ import annotations

from app.domain.repositories import AdminUserRepository
from app.security.jwt import TokenError, create_access_token, create_refresh_token, decode_token
from app.security.passwords import verify_password


class InvalidCredentialsError(Exception):
    """Raised for bad username/password, or an invalid/expired refresh token.
    Deliberately one exception type for both — the router must not leak which
    part of auth failed."""


class AuthService:
    def __init__(self, admin_user_repo: AdminUserRepository):
        self._admin_user_repo = admin_user_repo

    async def login(self, username: str, password: str) -> tuple[str, str]:
        user = await self._admin_user_repo.get_by_username(username)
        if user is None or not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError()
        access_token = create_access_token(
            subject=user.username, role=user.role.value, full_name=user.full_name
        )
        refresh_token = create_refresh_token(
            subject=user.username, full_name=user.full_name
        )
        return access_token, refresh_token

    async def refresh_access_token(self, refresh_token: str) -> str:
        try:
            payload = decode_token(refresh_token)
        except TokenError as exc:
            raise InvalidCredentialsError() from exc
        if payload.get("type") != "refresh":
            raise InvalidCredentialsError()

        user = await self._admin_user_repo.get_by_username(payload["sub"])
        if user is None:
            raise InvalidCredentialsError()
        return create_access_token(
            subject=user.username, role=user.role.value, full_name=user.full_name
        )
