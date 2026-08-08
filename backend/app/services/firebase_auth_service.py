"""Firebase token verification and user upsert.

Receives a Firebase ID token from the frontend (issued after email/password
or Google sign-in via the Firebase JS SDK), verifies it via the Admin SDK,
then looks up or creates the corresponding admin_users row.
"""

from __future__ import annotations

import json
from pathlib import Path

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin.credentials import Certificate

from app.config import get_settings
from app.domain.models import AdminRole, AdminUser
from app.domain.repositories import AdminUserRepository
from app.security.jwt import create_access_token, create_refresh_token

_firebase_app: firebase_admin.App | None = None


def _ensure_firebase_app() -> None:
    """Lazy-init the Firebase Admin SDK from the JSON credential file path
    in settings. Supports both absolute and relative paths (relative = from
    the backend/ directory)."""
    global _firebase_app
    if _firebase_app is not None:
        return
    settings = get_settings()
    if not settings.firebase_admin_cred_path:
        raise RuntimeError(
            "FIREBASE_ADMIN_CRED_PATH is not set — cannot verify Firebase tokens"
        )
    cred_path = Path(settings.firebase_admin_cred_path)
    if not cred_path.is_absolute():
        # resolve relative to the backend/ directory
        cred_path = Path(__file__).resolve().parent.parent.parent / cred_path
    with open(cred_path) as f:
        cred_dict = json.load(f)
    cred = Certificate(cred_dict)
    _firebase_app = firebase_admin.initialize_app(cred)


class FirebaseAuthService:
    def __init__(self, admin_user_repo: AdminUserRepository):
        self._admin_user_repo = admin_user_repo

    async def authenticate_firebase_token(
        self, id_token: str
    ) -> tuple[str, str]:
        """Verify a Firebase ID token, upsert the user in admin_users,
        and return our own (access_token, refresh_token) pair."""
        _ensure_firebase_app()

        decoded = firebase_auth.verify_id_token(id_token)
        email: str = decoded.get("email", "")
        firebase_uid: str = decoded.get("uid", "")
        name: str = decoded.get("name", "")

        if not email:
            # Google auth sometimes provides a uid-based placeholder;
            # fall back to the uid so sign-up doesn't silently fail.
            email = f"{firebase_uid}@firebase.local"
            name = name or firebase_uid

        # Lookup existing user by email — our admin_users table uses
        # username as the login key for email/password, but for Firebase
        # users we key off email to avoid duplicates.
        user = await self._admin_user_repo.get_by_email(email)

        if user is None:
            # First-time Firebase sign-in → create staff account
            username = email.split("@")[0]
            # Ensure username is unique
            existing = await self._admin_user_repo.get_by_username(username)
            if existing is not None:
                username = f"{username}-{firebase_uid[:6]}"

            user = await self._admin_user_repo.add(
                AdminUser(
                    id=None,
                    username=username,
                    email=email,
                    hashed_password="",  # Firebase-managed password
                    role=AdminRole.staff,
                    full_name=name or "",
                )
            )
        elif name and not user.full_name:
            # Firebase provided a name on a returning user whose record predates
            # the full_name column (or whose record was seeded without one).
            # Backfill so the sidebar shows the real name next time.
            await self._admin_user_repo.update_full_name(user.username, name)

        access_token = create_access_token(
            subject=user.username, role=user.role.value, full_name=user.full_name
        )
        refresh_token = create_refresh_token(
            subject=user.username, full_name=user.full_name
        )
        return access_token, refresh_token
