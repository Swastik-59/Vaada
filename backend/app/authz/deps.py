from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.authz.permissions import role_allows
from app.core.config import Settings, get_settings
from app.core.errors import AuthenticationFailed, AuthorizationFailed
from app.core.security import constant_time_equals, decode_access_token
from app.db.models import Membership, User


from datetime import UTC, datetime
from sqlalchemy import select

@dataclass
class Principal:
    user: User
    user_uid: str
    session_id: str | None
    membership: Membership
    tenant_id: str
    role: str
    correlation_id: str | None


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_db() -> Session:  # replaced by application factory
    raise RuntimeError("Database dependency is wired in application factory")


def current_principal(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Principal:
    token = request.cookies.get("vaada_access")
    is_cookie_auth = bool(token)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if not token:
        raise AuthenticationFailed("Authentication required.")
    try:
        payload = decode_access_token(token, settings)
    except Exception as exc:  # noqa: BLE001
        raise AuthenticationFailed("Authentication required.") from exc
    if payload.get("typ") != "access":
        raise AuthenticationFailed("Authentication required.")

    sub = payload.get("sub")
    if not sub:
        raise AuthenticationFailed("Authentication required.")

    # Primary lookup by permanent server-generated UID
    user = db.scalar(select(User).where(User.uid == sub))
    if user is None:
        # Fallback to internal primary key for backward compatibility
        user = db.get(User, sub)

    if user is None:
        raise AuthenticationFailed("Authentication required.")

    # Account status & deactivation enforcement
    if not user.is_active or user.status != "active":
        raise AuthenticationFailed("Account is disabled or pending verification.")

    # Account lockout enforcement
    if user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=UTC)
        if locked_until > datetime.now(UTC):
            raise AuthenticationFailed("Account is temporarily locked.")

    # Global session revocation check via session_version
    token_ver = payload.get("ver")
    if token_ver is not None and token_ver != user.session_version:
        raise AuthenticationFailed("Session has been revoked.")

    if is_cookie_auth:
        _enforce_csrf(request, settings)

    tenant_id = request.headers.get("X-Vaada-Tenant-Id")
    memberships = list(user.memberships)
    if not memberships:
        raise AuthorizationFailed("No tenant membership.")
    if tenant_id:
        membership = next((item for item in memberships if item.tenant_id == tenant_id), None)
        if membership is None:
            raise AuthorizationFailed("Not a member of the requested tenant.")
    elif len(memberships) == 1:
        membership = memberships[0]
    else:
        raise AuthorizationFailed("X-Vaada-Tenant-Id is required when multiple memberships exist.")

    return Principal(
        user=user,
        user_uid=user.uid,
        session_id=payload.get("jti"),
        membership=membership,
        tenant_id=membership.tenant_id,
        role=membership.role,
        correlation_id=getattr(request.state, "correlation_id", None),
    )


def require_permission(permission: str):
    def _dep(principal: Principal = Depends(current_principal)) -> Principal:
        if not role_allows(principal.role, permission):
            raise AuthorizationFailed("Insufficient permissions.")
        return principal

    return _dep


def _enforce_csrf(request: Request, settings: Settings) -> None:
    if request.method in SAFE_METHODS:
        return
    header = request.headers.get("X-CSRF-Token")
    cookie = request.cookies.get("vaada_csrf")
    if not header or not cookie or not constant_time_equals(header, cookie):
        raise AuthenticationFailed("CSRF validation failed.")
