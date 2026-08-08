from __future__ import annotations

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.routers import auth, leads_admin, leads_public
from app.security.cors import PathScopedCORSMiddleware
from app.security.rate_limit import limiter

logger = logging.getLogger(__name__)
settings = get_settings()

app = FastAPI(title="Alliance Australia Property — Leads CRM API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Two independent CORS allow-lists (Engineering Rules §2) — the external
# lead-capture site's origin(s) only ever apply to POST /api/leads; the CRM
# dashboard's own origin(s) apply to everything else.
app.add_middleware(
    PathScopedCORSMiddleware,
    public_paths={"/api/leads"},
    public_origins=settings.cors_public_lead_origins,
    dashboard_origins=settings.cors_dashboard_origins,
)

app.include_router(leads_public.router)
app.include_router(leads_admin.router)
app.include_router(leads_admin.dashboard_router)
app.include_router(auth.router)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    # Field-level feedback is fine (expected client-error detail); this just
    # keeps the shape consistent across every router.
    return JSONResponse(
        # Plain int, not status.HTTP_422_UNPROCESSABLE_ENTITY: that name is
        # deprecated in newer Starlette in favor of _CONTENT, but the older
        # name isn't guaranteed present on every Starlette version this repo
        # might run — 422 itself is stable regardless of which name aliases it.
        status_code=422,
        content={"detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    # No stack traces, no SQL errors, no internal detail in any response
    # (Engineering Rules §2) — this endpoint set includes an unauthenticated,
    # internet-facing route.
    logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


@app.get("/health", tags=["ops"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
