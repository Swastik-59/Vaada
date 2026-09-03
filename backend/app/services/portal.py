from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
import jwt

from app.core.config import get_settings
from app.core.errors import AuthenticationFailed


def generate_portal_token(
    *,
    case_id: str,
    invoice_id: str,
    tenant_id: str,
    expires_in_days: int = 14,
) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "typ": "customer_portal",
        "case_id": case_id,
        "invoice_id": invoice_id,
        "tenant_id": tenant_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=expires_in_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def verify_portal_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "case_id", "invoice_id", "tenant_id"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthenticationFailed("Portal access link has expired. Request an updated settlement link.") from exc
    except Exception as exc:
        raise AuthenticationFailed("Invalid portal access token.") from exc

    if payload.get("typ") != "customer_portal":
        raise AuthenticationFailed("Invalid token type for customer portal.")

    return payload
