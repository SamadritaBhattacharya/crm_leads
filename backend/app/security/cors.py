"""Path-scoped CORS.

Engineering Rules §2 requires two independent, never-merged allow-lists: the
external lead-capture site's origin(s) for `POST /api/leads` only, and this
repo's own CRM dashboard origin(s) for everything else. Starlette's stock
`CORSMiddleware` only supports one global allow-list per app, so a small
custom middleware is the straightforward way to keep the two lists from ever
being conflated — not a hand-rolled substitute for a solved problem, just
routing the *existing* solved problem (origin header matching) to the right
list based on path.
"""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp


class PathScopedCORSMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        *,
        public_paths: set[str],
        public_origins: list[str],
        dashboard_origins: list[str],
    ) -> None:
        super().__init__(app)
        self._public_paths = public_paths
        self._public_origins = set(public_origins)
        self._dashboard_origins = set(dashboard_origins)

    async def dispatch(self, request: Request, call_next) -> Response:
        origin = request.headers.get("origin")
        allowed_origins = (
            self._public_origins if request.url.path in self._public_paths else self._dashboard_origins
        )

        if request.method == "OPTIONS" and origin is not None:
            if origin not in allowed_origins:
                return Response(status_code=400)
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Methods": request.headers.get(
                        "access-control-request-method", "*"
                    ),
                    "Access-Control-Allow-Headers": request.headers.get(
                        "access-control-request-headers", "*"
                    ),
                    "Vary": "Origin",
                },
            )

        response = await call_next(request)
        if origin is not None and origin in allowed_origins:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Vary"] = "Origin"
        return response
