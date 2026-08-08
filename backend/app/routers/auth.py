from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import AuthServiceDep, FirebaseAuthServiceDep
from app.schemas.auth import FirebaseTokenRequest, LoginRequest, RefreshRequest, TokenResponse
from app.security.deps import CurrentUser, get_current_user
from app.security.jwt import create_access_token, create_refresh_token
from app.services.auth_service import AuthService, InvalidCredentialsError

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, auth_service: AuthServiceDep) -> TokenResponse:
    try:
        access_token, refresh_token = await auth_service.login(payload.username, payload.password)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        ) from exc
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, auth_service: AuthServiceDep) -> TokenResponse:
    try:
        access_token = await auth_service.refresh_access_token(payload.refresh_token)
    except InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        ) from exc
    return TokenResponse(access_token=access_token, refresh_token=payload.refresh_token)


@router.post("/firebase", response_model=TokenResponse)
async def firebase_login(
    payload: FirebaseTokenRequest,
    firebase_auth_service: FirebaseAuthServiceDep,
) -> TokenResponse:
    """Exchange a Firebase ID token for CRM JWT tokens."""
    try:
        access_token, refresh_token = await firebase_auth_service.authenticate_firebase_token(
            payload.id_token
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase authentication failed",
        ) from exc
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


class MeOut(BaseModel):
    username: str
    role: str
    full_name: str = ""


class UpdateNameIn(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=255)


class TokenWithNameResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.get("/me", response_model=MeOut)
async def get_me(
    auth_service: AuthServiceDep,
    current_user: CurrentUser = Depends(get_current_user),
) -> MeOut:
    user = await auth_service._admin_user_repo.get_by_username(current_user.username)
    return MeOut(
        username=current_user.username,
        role=current_user.role.value,
        full_name=user.full_name if user else current_user.full_name,
    )


@router.patch("/me", response_model=TokenWithNameResponse)
async def update_me(
    payload: UpdateNameIn,
    auth_service: AuthServiceDep,
    current_user: CurrentUser = Depends(get_current_user),
) -> TokenWithNameResponse:
    """Update the authenticated user's full_name and return fresh tokens."""
    user = await auth_service._admin_user_repo.get_by_username(current_user.username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    new_name = payload.full_name.strip()
    await auth_service._admin_user_repo.update_full_name(current_user.username, new_name)
    access_token = create_access_token(
        subject=user.username, role=user.role.value, full_name=new_name
    )
    refresh_token = create_refresh_token(
        subject=user.username, full_name=new_name
    )
    return TokenWithNameResponse(access_token=access_token, refresh_token=refresh_token)
