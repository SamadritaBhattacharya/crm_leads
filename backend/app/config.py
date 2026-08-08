"""Application settings — all secrets and environment-specific values live
here, sourced from the environment / `.env`, never hardcoded or committed
(Engineering Rules §8).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Database -----------------------------------------------------
    # asyncpg DSN, e.g. postgresql+asyncpg://user:pass@host:5432/dbname
    database_url: str
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_echo: bool = False

    # --- Auth (staff JWT) ------------------------------------------------
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    refresh_token_expire_days: int = 7

    # --- CORS — two independent allow-lists, never merged (Engineering Rules §2) ---
    # Origins for the CRM dashboard (this repo's own Next.js app).
    cors_dashboard_origins: list[str] = []
    # Origin(s) of the external, separately-maintained lead-capture site — for
    # POST /api/leads only. Coordinated with that repo's maintainers, not guessed.
    cors_public_lead_origins: list[str] = []

    # --- Rate limiting (public endpoint only) ---------------------------
    rate_limit_leads_per_minute: int = 10

    # --- Firebase Auth --------------------------------------------------
    # Path to Firebase Admin SDK service account JSON file.
    # Download from Firebase Console → Project Settings → Service Accounts
    firebase_admin_cred_path: str | None = None

    # --- Email notifications --------------------------------------------
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True
    smtp_from_address: str | None = None
    staff_notification_email: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
