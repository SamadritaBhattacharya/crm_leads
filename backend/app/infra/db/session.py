"""Async SQLAlchemy engine/session — the only place connection pooling is
configured. `pool_size`/`max_overflow` matter here specifically because the
scaling posture (System Architecture §9) is "single instance, multiple
workers": each worker process gets its own pool against Supabase's connection
limit, so this must stay a deliberate, reviewed number, not a default.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.db_echo,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — one session per request, always closed."""
    async with async_session_maker() as session:
        yield session
