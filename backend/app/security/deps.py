"""FastAPI dependencies enforcing the JWT trust boundary on `/api/leads/*`
mutation endpoints (System Architecture §5). This is intentionally the only
place a router touches token verification — routers depend on
`get_current_user`/`require_admin`, never on `security/jwt.py` directly.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.domain.models import AdminRole
from app.security.jwt import TokenError, decode_token

_bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    username: str
    role: AdminRole
    full_name: str = ""


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> CurrentUser:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return CurrentUser(
        username=payload["sub"],
        role=AdminRole(payload["role"]),
        full_name=payload.get("full_name", "") or "",
    )


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.role != AdminRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
    return user
