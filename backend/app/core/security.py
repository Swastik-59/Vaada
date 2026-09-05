from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import VerifyMismatchError

from app.core.config import Settings
from app.core.errors import ValidationFailed
from app.core.identity import generate_session_jti

# OWASP ASVS V6.2: Argon2id with 64MB memory, 2 iterations, 2 threads
_hasher = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=2, hash_len=32, type=Type.ID)

TokenType = Literal["access"]

COMMON_WEAK_PASSWORDS = frozenset({
    "password123",
    "password123!",
    "password1234",
    "password1234!",
    "admin12345",
    "admin12345!",
    "qwerty1234",
    "operator123",
    "operator123!",
    "letmein1234",
    "welcome1234",
    "1234567890",
})


def validate_password_strength(password: str) -> None:
    """
    OWASP ASVS V6.2: Enforce strong password complexity rules.
    - Minimum length 10 characters
    - Must contain at least 1 lowercase letter, 1 uppercase letter, 1 digit, and 1 symbol
    - Checked against common weak/leaked password blocklist
    """
    if len(password) < 10:
        raise ValidationFailed("Password must be at least 10 characters in length.")

    if not any(c.islower() for c in password):
        raise ValidationFailed("Password must contain at least one lowercase letter.")

    if not any(c.isupper() for c in password):
        raise ValidationFailed("Password must contain at least one uppercase letter.")

    if not any(c.isdigit() for c in password):
        raise ValidationFailed("Password must contain at least one numeric digit.")

    if not any(not c.isalnum() for c in password):
        raise ValidationFailed("Password must contain at least one special symbol.")

    if password.lower() in COMMON_WEAK_PASSWORDS:
        raise ValidationFailed("Password is too common or easily guessable.")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def create_access_token(
    *,
    user_uid: str | None = None,
    session_jti: str | None = None,
    session_version: int = 1,
    settings: Settings,
    user_id: str | None = None,  # Backward compatibility
) -> str:
    """
    Issue short-lived JWT bound to the immutable User UID and session JTI.
    ASVS 7.2: Bound to server-side session_version for instant revocation.
    """
    canonical_sub = user_uid or user_id
    if not canonical_sub:
        raise ValueError("Either user_uid or user_id is required to create an access token.")

    jti = session_jti or generate_session_jti()
    now = datetime.now(UTC)
    payload = {
        "sub": canonical_sub,
        "jti": jti,
        "ver": session_version,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_minutes)).timestamp()),
        "typ": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str, settings: Settings) -> dict[str, Any]:
    """
    ASVS 7.2: Strictly validate algorithm, audience, issuer, expiry, and required claims.
    """
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={"require": ["exp", "iat", "iss", "aud", "sub", "typ"]},
    )


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))
