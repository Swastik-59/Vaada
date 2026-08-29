from __future__ import annotations

from datetime import UTC, datetime

CAUSE_WEIGHTS = {
    "insufficient_funds": -0.4,
    "bank_decline": -0.9,
    "network_error": 0.3,
    "customer_dispute": -1.4,
    "invoice_mismatch": -0.6,
    "card_expired": -0.2,
    "mandate_failed": -0.8,
    "unstructured_text": -0.3,
    "unknown": -0.5,
}


def _sigmoid(value: float) -> float:
    import math

    return 1.0 / (1.0 + math.exp(-value))


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def score_recovery(
    *,
    root_cause: str,
    amount_minor: int,
    due_at: datetime,
    now: datetime,
    prior_contacts: int,
) -> float:
    days_overdue = max((_as_utc(now) - _as_utc(due_at)).days, 0)
    amount_lakh = amount_minor / 10_000_000
    logit = (
        0.8
        + CAUSE_WEIGHTS.get(root_cause, -0.5)
        - min(days_overdue, 90) * 0.02
        - min(amount_lakh, 20) * 0.04
        - prior_contacts * 0.15
    )
    probability = _sigmoid(logit)
    return round(min(max(probability, 0.01), 0.99), 5)
