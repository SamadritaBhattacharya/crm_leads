"""Ensures Settings() can construct in a test environment without a real
.env file. Must run before any `app.*` module is imported, since several
modules (e.g. app.security.jwt) read settings at import time.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-unit-tests-only")
