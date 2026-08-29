from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code = 500
    code = "internal_error"

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_failed"


class AuthenticationFailed(AppError):
    status_code = 401
    code = "authentication_failed"


class AuthorizationFailed(AppError):
    status_code = 403
    code = "authorization_failed"


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


class RateLimited(AppError):
    status_code = 429
    code = "rate_limited"


class DependencyFailed(AppError):
    status_code = 503
    code = "dependency_failed"


class PayloadTooLarge(AppError):
    status_code = 413
    code = "payload_too_large"
