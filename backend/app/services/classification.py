from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.razorpay.normalizer import normalize_razorpay_error

RULE_CODES = {
    "INSUFFICIENT_FUNDS": "insufficient_funds",
    "BANK_DECLINE": "bank_decline",
    "NETWORK_ERROR": "network_error",
    "CUSTOMER_DISPUTE": "customer_dispute",
    "INVOICE_MISMATCH": "invoice_mismatch",
    "CARD_EXPIRED": "card_expired",
    "MANDATE_FAILED": "mandate_failed",
}


@dataclass(frozen=True)
class ClassificationResult:
    root_cause: str
    method: str
    reason: str
    official_error: dict[str, Any] | None = None
    derived_policy: dict[str, Any] | None = None


def classify_event(
    *,
    failure_code: str | None = None,
    note: str | None = None,
    payload: dict[str, Any] | None = None,
    payment_method: str | None = None,
) -> ClassificationResult:
    # 1. Primary path: Official Razorpay Taxonomy Normalization & Lookup
    norm = normalize_razorpay_error(
        payload,
        payment_method=payment_method,
        failure_code=failure_code,
        note=note,
    )
    if norm["matched"] and norm["official"]:
        official = norm["official"]
        return ClassificationResult(
            root_cause=official["reason"],
            method="RULE",
            reason=f"Official Razorpay taxonomy match ({official['code']} / {official['reason']}): {official['description']}",
            official_error=official,
            derived_policy=norm["derived"],
        )

    # 2. Legacy / Standard rule code mapping
    if failure_code:
        normalized = failure_code.strip().upper()
        if normalized in RULE_CODES:
            return ClassificationResult(
                root_cause=RULE_CODES[normalized],
                method="RULE",
                reason=f"Mapped provider failure code {normalized}.",
                official_error=None,
                derived_policy=norm["derived"],
            )

    # 3. Unstructured note requiring LLM analysis
    if note and note.strip():
        return ClassificationResult(
            root_cause="unstructured_text",
            method="LLM",
            reason="No deterministic failure code; unstructured note requires LLM fallback.",
            official_error=None,
            derived_policy=norm["derived"],
        )

    # 4. Fallback unknown
    return ClassificationResult(
        root_cause="unknown",
        method="RULE",
        reason="No failure code or note was present; classified as unknown without LLM.",
        official_error=None,
        derived_policy=norm["derived"],
    )
