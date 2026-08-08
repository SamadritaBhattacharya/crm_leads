"""FastAPI's own staff-auth JWT — independent of the Supabase RLS token that
secures the Realtime channel (System Architecture §5). Never assume these are
interchangeable.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from jose import JWTError, jwt

from app.config import get_settings

settings = get_settings()

TokenType = Literal["access", "refresh"]


class TokenError(Exception):
    """Raised for any invalid, expired, or malformed token."""


def create_access_token(*, subject: str, role: str, full_name: str = "") -> str:
    return _encode(subject=subject, token_type="access",
                    extra_claims={"role": role, "full_name": full_name},
                    expires_delta=timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(*, subject: str, full_name: str = "") -> str:
    return _encode(subject=subject, token_type="refresh",
                    extra_claims={"full_name": full_name},
                    expires_delta=timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise TokenError(str(exc)) from exc


def _encode(
    *, subject: str, token_type: TokenType, extra_claims: dict[str, Any], expires_delta: timedelta
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        **extra_claims,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
