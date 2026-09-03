from __future__ import annotations

import hashlib
import hmac

from app.core.errors import DependencyFailed
from app.events.base import EventSource, NormalizedPaymentEvent


class RazorpayTestModeSource(EventSource):
    """Test-mode adapter. Does not invent payments. Requires live credentials to pull."""

    def __init__(self, *, key_id: str, key_secret: str) -> None:
        self.key_id = key_id.strip()
        self.key_secret = key_secret.strip()

    def source_name(self) -> str:
        return "razorpay_test"

    def pull(self) -> list[NormalizedPaymentEvent]:
        if not self.key_id or not self.key_secret:
            raise DependencyFailed(
                "Razorpay test-mode keys are not configured. "
                "Set VAADA_RAZORPAY_KEY_ID and VAADA_RAZORPAY_KEY_SECRET, "
                "or keep the synthetic EventSource."
            )
        raise DependencyFailed(
            "Razorpay pull is wired behind EventSource but this environment has not "
            "completed a signed test-mode fetch. Use POST /api/v1/webhooks/razorpay "
            "with a valid webhook signature instead of fabricating events."
        )


def verify_razorpay_signature(*, body: bytes, signature: str, secret: str) -> bool:
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def generate_razorpay_signature(*, body: bytes, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

