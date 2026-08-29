from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AuthenticationFailed
from app.core.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_csrf_token,
    new_refresh_token,
    verify_password,
)
from app.db.models import ActorType, RefreshToken, User
from app.services.audit import write_audit


def authenticate(db: Session, *, email: str, password: str, settings: Settings, correlation_id: str | None) -> User:
    user = db.scalar(select(User).where(User.email == email.lower()))
    valid = bool(user and user.is_active and verify_password(password, user.password_hash))
    if not valid:
        write_audit(
            db,
            action="auth.login_failed",
            resource_type="user",
            actor_type=ActorType.USER.value,
            correlation_id=correlation_id,
            payload={"email_domain": email.split("@")[-1] if "@" in email else None},
        )
        raise AuthenticationFailed("Invalid email or password.")
    write_audit(
        db,
        action="auth.login_succeeded",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
        correlation_id=correlation_id,
    )
    return user


def issue_session(db: Session, *, user: User, settings: Settings) -> tuple[str, str, str, datetime]:
    access = create_access_token(user_id=user.id, settings=settings)
    refresh = new_refresh_token()
    csrf = new_csrf_token()
    expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            expires_at=expires,
        )
    )
    db.flush()
    return access, refresh, csrf, expires


def rotate_refresh(db: Session, *, refresh_token: str, settings: Settings) -> tuple[User, str, str, str, datetime]:
    token_row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
    now = datetime.now(UTC)
    if token_row is None or token_row.revoked_at is not None or token_row.expires_at <= now:
        raise AuthenticationFailed("Refresh token is invalid.")
    user = db.get(User, token_row.user_id)
    if user is None or not user.is_active:
        raise AuthenticationFailed("Refresh token is invalid.")
    access, new_refresh, csrf, expires = issue_session(db, user=user, settings=settings)
    token_row.revoked_at = now
    token_row.replaced_by_id = None
    db.flush()
    write_audit(
        db,
        action="auth.refresh",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
    )
    return user, access, new_refresh, csrf, expires


def revoke_refresh(db: Session, *, refresh_token: str | None, user_id: str | None, correlation_id: str | None) -> None:
    if refresh_token:
        token_row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
        if token_row and token_row.revoked_at is None:
            token_row.revoked_at = datetime.now(UTC)
    write_audit(
        db,
        action="auth.logout",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user_id,
        correlation_id=correlation_id,
    )


def hash_user_password(password: str) -> str:
    return hash_password(password)
