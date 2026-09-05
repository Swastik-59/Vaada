from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AuthenticationFailed, Conflict, ValidationFailed
from app.core.identity import (
    generate_session_jti,
    generate_user_uid,
    generate_verification_token,
    hash_token,
)
from app.core.security import (
    create_access_token,
    hash_password,
    new_csrf_token,
    new_refresh_token,
    validate_password_strength,
    verify_password,
)
from app.db.models import (
    ActorType,
    Membership,
    RefreshToken,
    Role,
    Tenant,
    User,
    UserStatus,
    VerificationToken,
    VerificationTokenType,
)
from app.services.audit import write_audit


def authenticate(
    db: Session,
    *,
    email: str,
    password: str,
    settings: Settings,
    correlation_id: str | None,
) -> User:
    email_clean = email.strip().lower()
    user = db.scalar(select(User).where(User.email == email_clean))
    now = datetime.now(UTC)

    # Brute force protection: enforce temporary account lockout
    if user and user.locked_until:
        locked_until = user.locked_until
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=UTC)
        if locked_until > now:
            write_audit(
                db,
                action="auth.login_locked",
                resource_type="user",
                actor_type=ActorType.USER.value,
                actor_id=user.id,
                actor_uid=user.uid,
                correlation_id=correlation_id,
                payload={"email_domain": email_clean.split("@")[-1] if "@" in email_clean else None},
            )
            db.commit()
            raise AuthenticationFailed("Account is temporarily locked. Please try again later.")

    valid = bool(
        user
        and user.is_active
        and user.status == UserStatus.ACTIVE.value
        and verify_password(password, user.password_hash)
    )

    if not valid:
        if user:
            user.failed_login_count += 1
            if user.failed_login_count >= 5:
                user.locked_until = now + timedelta(minutes=15)
                write_audit(
                    db,
                    action="auth.account_locked",
                    resource_type="user",
                    actor_type=ActorType.USER.value,
                    actor_id=user.id,
                    actor_uid=user.uid,
                    correlation_id=correlation_id,
                    payload={"failed_attempts": user.failed_login_count, "lockout_minutes": 15},
                )

        write_audit(
            db,
            action="auth.login_failed",
            resource_type="user",
            actor_type=ActorType.USER.value,
            actor_id=user.id if user else None,
            actor_uid=user.uid if user else None,
            correlation_id=correlation_id,
            payload={"email_domain": email_clean.split("@")[-1] if "@" in email_clean else None},
        )
        db.commit()
        raise AuthenticationFailed("Invalid email or password.")

    # Successful login resets failure counters
    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = now
    db.flush()

    write_audit(
        db,
        action="auth.login_succeeded",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
        actor_uid=user.uid,
        correlation_id=correlation_id,
    )
    return user


def issue_session(db: Session, *, user: User, settings: Settings) -> tuple[str, str, str, datetime]:
    session_jti = generate_session_jti()
    access = create_access_token(
        user_uid=user.uid,
        session_jti=session_jti,
        session_version=user.session_version,
        settings=settings,
    )
    refresh = new_refresh_token()
    csrf = new_csrf_token()
    expires = datetime.now(UTC) + timedelta(days=settings.refresh_token_days)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(refresh),
            session_id=session_jti,
            session_version=user.session_version,
            expires_at=expires,
        )
    )
    db.flush()
    return access, refresh, csrf, expires


def rotate_refresh(db: Session, *, refresh_token: str, settings: Settings) -> tuple[User, str, str, str, datetime]:
    token_row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
    now = datetime.now(UTC)
    if token_row is None or token_row.revoked_at is not None:
        raise AuthenticationFailed("Refresh token is invalid.")

    expires_at = token_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if expires_at <= now:
        raise AuthenticationFailed("Refresh token is invalid.")

    user = db.get(User, token_row.user_id)
    if user is None or not user.is_active or user.status != UserStatus.ACTIVE.value:
        raise AuthenticationFailed("Refresh token is invalid.")

    # Invalidate session if session_version has bumped (e.g. password changed)
    if token_row.session_version != user.session_version:
        token_row.revoked_at = now
        db.flush()
        raise AuthenticationFailed("Session has been revoked.")

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
        actor_uid=user.uid,
    )
    return user, access, new_refresh, csrf, expires


def revoke_refresh(
    db: Session,
    *,
    refresh_token: str | None,
    user: User | None = None,
    user_id: str | None = None,
    user_uid: str | None = None,
    correlation_id: str | None = None,
) -> None:
    if refresh_token:
        token_row = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token)))
        if token_row and token_row.revoked_at is None:
            token_row.revoked_at = datetime.now(UTC)
            db.flush()

    actor_id = user.id if user else user_id
    actor_uid = user.uid if user else user_uid
    write_audit(
        db,
        action="auth.logout",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        actor_uid=actor_uid,
        correlation_id=correlation_id,
    )


def change_user_password(
    db: Session,
    *,
    user: User,
    current_password: str,
    new_password: str,
    new_password_confirm: str,
    correlation_id: str | None = None,
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AuthenticationFailed("Current password is incorrect.")
    if new_password != new_password_confirm:
        raise ValidationFailed("New password and confirmation do not match.")
    validate_password_strength(new_password)

    now = datetime.now(UTC)
    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    # Instant revocation of all active sessions
    user.session_version += 1
    db.flush()

    write_audit(
        db,
        action="auth.password_changed",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
        actor_uid=user.uid,
        correlation_id=correlation_id,
    )


def request_password_reset(
    db: Session,
    *,
    email: str,
    correlation_id: str | None = None,
) -> str | None:
    email_clean = email.strip().lower()
    user = db.scalar(select(User).where(User.email == email_clean))
    if not user or not user.is_active or user.status != UserStatus.ACTIVE.value:
        # Uniform computation to resist timing-based account enumeration
        hash_token("timing-equalization-token-value")
        return None

    raw_token = generate_verification_token()
    token_hash_val = hash_token(raw_token)
    expires = datetime.now(UTC) + timedelta(minutes=15)

    db.add(
        VerificationToken(
            user_id=user.id,
            token_hash=token_hash_val,
            token_type=VerificationTokenType.PASSWORD_RESET.value,
            expires_at=expires,
        )
    )
    db.flush()

    write_audit(
        db,
        action="auth.password_reset_requested",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
        actor_uid=user.uid,
        correlation_id=correlation_id,
    )
    return raw_token


def complete_password_reset(
    db: Session,
    *,
    token: str,
    new_password: str,
    new_password_confirm: str,
    correlation_id: str | None = None,
) -> User:
    if new_password != new_password_confirm:
        raise ValidationFailed("New password and confirmation do not match.")
    validate_password_strength(new_password)

    token_hash_val = hash_token(token)
    now = datetime.now(UTC)
    token_record = db.scalar(
        select(VerificationToken).where(
            VerificationToken.token_hash == token_hash_val,
            VerificationToken.token_type == VerificationTokenType.PASSWORD_RESET.value,
            VerificationToken.used_at.is_(None),
            VerificationToken.expires_at > now,
        )
    )
    if not token_record:
        raise AuthenticationFailed("Reset token is invalid or has expired.")

    user = db.get(User, token_record.user_id)
    if not user or not user.is_active:
        raise AuthenticationFailed("User account is inactive.")

    user.password_hash = hash_password(new_password)
    user.password_changed_at = now
    # Instant revocation of all previously active sessions
    user.session_version += 1
    token_record.used_at = now
    db.flush()

    write_audit(
        db,
        action="auth.password_reset_completed",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
        actor_uid=user.uid,
        correlation_id=correlation_id,
    )
    return user


def register_user(
    db: Session,
    *,
    email: str,
    password: str,
    password_confirm: str,
    tenant_name: str | None = None,
    correlation_id: str | None = None,
) -> User:
    email_clean = email.strip().lower()
    if "@" not in email_clean or len(email_clean) > 320:
        raise ValidationFailed("Invalid email address format.")
    if password != password_confirm:
        raise ValidationFailed("Password and confirmation do not match.")
    validate_password_strength(password)

    existing = db.scalar(select(User).where(User.email == email_clean))
    if existing:
        raise Conflict("An account with this email address already exists.")

    new_uid = generate_user_uid()
    user = User(
        uid=new_uid,
        email=email_clean,
        password_hash=hash_password(password),
        status=UserStatus.ACTIVE.value,
        is_active=True,
        session_version=1,
    )
    db.add(user)
    db.flush()

    org_title = tenant_name.strip() if tenant_name else f"Org {new_uid[-6:].upper()}"
    tenant = Tenant(
        slug=f"org-{new_uid[-8:]}",
        name=org_title,
        legal_name=f"{org_title} Technologies Private Limited",
    )
    db.add(tenant)
    db.flush()

    membership = Membership(
        user_id=user.id,
        tenant_id=tenant.id,
        role=Role.OPERATOR.value,
    )
    db.add(membership)
    db.flush()

    write_audit(
        db,
        action="auth.signup_completed",
        resource_type="user",
        actor_type=ActorType.USER.value,
        actor_id=user.id,
        actor_uid=user.uid,
        tenant_id=tenant.id,
        correlation_id=correlation_id,
    )
    return user


def hash_user_password(password: str) -> str:
    return hash_password(password)
