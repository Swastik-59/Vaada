from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import Settings
from app.core.errors import PayloadTooLarge, RateLimited

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.correlation_id = correlation_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = correlation_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        length = request.headers.get("content-length")
        if length and int(length) > self.max_bytes:
            return _error_response(request, PayloadTooLarge("Request body exceeds the allowed size."))
        return await call_next(request)


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Reject credentialed mutating requests whose Origin is not in the allow-list."""

    def __init__(self, app, settings: Settings) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.settings = settings

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in SAFE_METHODS:
            return await call_next(request)
        origin = request.headers.get("origin")
        if origin and origin not in self.settings.cors_origin_list:
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "authorization_failed",
                        "message": "Origin is not allowed.",
                        "correlation_id": getattr(request.state, "correlation_id", None),
                    }
                },
            )
        return await call_next(request)


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        bucket = self._hits[key]
        cutoff = now - window_seconds
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            raise RateLimited("Rate limit exceeded.")
        bucket.append(now)


RATE_LIMITS: dict[str, tuple[int, int]] = {
    "POST /api/v1/auth/login": (8, 60),
    "POST /api/v1/auth/refresh": (20, 60),
    "POST /api/v1/auth/logout": (30, 60),
    "POST /api/v1/events": (30, 60),
    "POST /api/v1/events/batch": (10, 60),
    "POST /api/v1/cases/{id}/actions": (20, 60),
    "POST /api/v1/cases/{id}/customer-replies": (10, 60),
    "default": (120, 60),
}


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limiter: InMemoryRateLimiter) -> None:  # type: ignore[no-untyped-def]
        super().__init__(app)
        self.limiter = limiter

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        client = request.client.host if request.client else "unknown"
        route_key = _route_limit_key(request)
        limit, window = RATE_LIMITS.get(route_key, RATE_LIMITS["default"])
        try:
            self.limiter.check(f"{client}:{route_key}", limit, window)
        except RateLimited as exc:
            return _error_response(request, exc)
        return await call_next(request)


def _route_limit_key(request: Request) -> str:
    path = request.url.path.rstrip("/")
    method = request.method
    if path.startswith("/api/v1/cases/") and path.endswith("/actions"):
        return "POST /api/v1/cases/{id}/actions"
    if path.startswith("/api/v1/cases/") and path.endswith("/customer-replies"):
        return "POST /api/v1/cases/{id}/customer-replies"
    return f"{method} {path}"


def _error_response(request: Request, exc: Exception) -> JSONResponse:
    status = getattr(exc, "status_code", 500)
    code = getattr(exc, "code", "internal_error")
    message = getattr(exc, "message", "Request failed.")
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "correlation_id": getattr(request.state, "correlation_id", None),
            }
        },
    )


def public_error_payload(request: Request, *, code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "correlation_id": getattr(request.state, "correlation_id", None),
        }
    }
    if details:
        body["error"]["details"] = details
    return body


BodySizeLimitMiddleware = BodySizeLimitMiddleware
InMemoryRateLimiter = InMemoryRateLimiter
public_error_payload = public_error_payload
