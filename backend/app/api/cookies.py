from __future__ import annotations

from datetime import datetime

from fastapi import Response

from app.core.config import Settings

ACCESS_COOKIE = "vaayda_access"
REFRESH_COOKIE = "vaayda_refresh"
CSRF_COOKIE = "vaayda_csrf"


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    csrf_token: str,
    refresh_expires: datetime,
    settings: Settings,
) -> None:
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
        "path": "/",
    }
    response.set_cookie(
        ACCESS_COOKIE,
        access_token,
        max_age=settings.access_token_minutes * 60,
        **cookie_kwargs,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=settings.refresh_token_days * 86400,
        **{**cookie_kwargs, "path": "/api/v1/auth"},
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
        max_age=settings.refresh_token_days * 86400,
    )


def clear_auth_cookies(response: Response) -> None:
    for name, path in (
        (ACCESS_COOKIE, "/"),
        (REFRESH_COOKIE, "/api/v1/auth"),
        (CSRF_COOKIE, "/"),
    ):
        response.delete_cookie(name, path=path)
