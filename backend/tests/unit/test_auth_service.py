import pytest

from app.domain.models import AdminRole, AdminUser
from app.security.jwt import decode_token
from app.security.passwords import hash_password
from app.services.auth_service import AuthService, InvalidCredentialsError
from tests.unit.fakes import FakeAdminUserRepository


@pytest.fixture
def staff_user() -> AdminUser:
    return AdminUser(
        id=1,
        username="staff1",
        email="staff1@example.com",
        hashed_password=hash_password("correct-horse"),
        role=AdminRole.staff,
    )


@pytest.fixture
def service(staff_user: AdminUser) -> AuthService:
    return AuthService(FakeAdminUserRepository([staff_user]))


async def test_login_with_correct_credentials_returns_tokens(service: AuthService) -> None:
    access_token, refresh_token = await service.login("staff1", "correct-horse")
    payload = decode_token(access_token)
    assert payload["sub"] == "staff1"
    assert payload["role"] == "staff"
    assert payload["type"] == "access"
    assert decode_token(refresh_token)["type"] == "refresh"


async def test_login_with_wrong_password_raises(service: AuthService) -> None:
    with pytest.raises(InvalidCredentialsError):
        await service.login("staff1", "wrong-password")


async def test_login_with_unknown_username_raises(service: AuthService) -> None:
    with pytest.raises(InvalidCredentialsError):
        await service.login("nobody", "whatever")


async def test_refresh_with_valid_refresh_token_returns_new_access_token(service: AuthService) -> None:
    _, refresh_token = await service.login("staff1", "correct-horse")
    new_access_token = await service.refresh_access_token(refresh_token)
    assert decode_token(new_access_token)["type"] == "access"


async def test_refresh_with_access_token_is_rejected(service: AuthService) -> None:
    access_token, _ = await service.login("staff1", "correct-horse")
    with pytest.raises(InvalidCredentialsError):
        await service.refresh_access_token(access_token)


async def test_refresh_with_garbage_token_raises(service: AuthService) -> None:
    with pytest.raises(InvalidCredentialsError):
        await service.refresh_access_token("not-a-real-token")
