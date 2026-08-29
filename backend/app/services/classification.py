from __future__ import annotations

from dataclasses import dataclass

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


def classify_event(*, failure_code: str | None, note: str | None) -> ClassificationResult:
    if failure_code:
        normalized = failure_code.strip().upper()
        if normalized in RULE_CODES:
            return ClassificationResult(
                root_cause=RULE_CODES[normalized],
                method="RULE",
                reason=f"Mapped provider failure code {normalized}.",
            )
    if note and note.strip():
        return ClassificationResult(
            root_cause="unstructured_text",
            method="LLM",
            reason="No deterministic failure code; unstructured note requires LLM fallback.",
        )
    return ClassificationResult(
        root_cause="unknown",
        method="RULE",
        reason="No failure code or note was present; classified as unknown without LLM.",
    )
