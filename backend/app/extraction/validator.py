from __future__ import annotations

from datetime import date
from typing import Any

from app.extraction.schemas import PromiseCommitment


def validate_extraction_payload(
    payload: dict[str, Any],
    *,
    invoice_amount_minor: int,
    today: date,
    raw_text: str,
) -> tuple[PromiseCommitment | None, str | None]:
    """Validate JSON extraction dictionary against PromiseCommitment schema and business invariants.
    Returns (validated_commitment, failure_reason).
    """
    try:
        commitment = PromiseCommitment.model_validate(payload)
    except Exception:
        return None, "malformed_output"

    commitment.raw_text = raw_text

    # Basic invariant checks
    if commitment.amount is not None and commitment.amount > invoice_amount_minor:
        return commitment, "amount_exceeds_invoice"

    if commitment.promised_date is not None and commitment.promised_date < today:
        return commitment, "date_in_past"

    if commitment.confidence is not None and commitment.confidence < 0.50:
        return commitment, "low_confidence"

    if commitment.amount is None and commitment.promised_date is None:
        return commitment, "no_commitment_detected"

    return commitment, None
