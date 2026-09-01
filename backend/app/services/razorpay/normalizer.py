from __future__ import annotations

from typing import Any

from app.services.razorpay.policy_mapper import derive_recovery_policy
from app.services.razorpay.taxonomy import get_taxonomy_service


def normalize_razorpay_error(
    raw_payload: dict[str, Any] | None,
    *,
    payment_method: str | None = None,
    failure_code: str | None = None,
    note: str | None = None,
) -> dict[str, Any]:
    """
    Normalizes a Razorpay error payload, performs authoritative taxonomy lookup,
    and attaches derived recovery intelligence without conflating official and derived layers.
    """
    payload = raw_payload or {}

    # Extract structured error block if nested inside {"error": {...}}
    err_block = payload.get("error", {}) if isinstance(payload.get("error"), dict) else payload

    code = (
        err_block.get("code")
        or payload.get("code")
        or payload.get("failure_code")
        or failure_code
    )
    reason = err_block.get("reason") or payload.get("reason")
    source = err_block.get("source") or payload.get("source")
    step = err_block.get("step") or payload.get("step")
    description = err_block.get("description") or payload.get("description") or note
    field = err_block.get("field") or payload.get("field")
    metadata = err_block.get("metadata") or payload.get("metadata") or {}
    method = err_block.get("payment_method") or payload.get("payment_method") or payment_method

    # Preserve the raw structure for auditing/debugging
    raw_normalized = {
        "code": str(code) if code else None,
        "reason": str(reason) if reason else None,
        "source": str(source) if source else None,
        "step": str(step) if step else None,
        "description": str(description) if description else None,
        "field": str(field) if field else None,
        "metadata": metadata if isinstance(metadata, dict) else {},
    }

    # Perform deterministic taxonomy lookup
    taxonomy_svc = get_taxonomy_service()
    entry = taxonomy_svc.lookup(
        code=code,
        reason=reason,
        payment_method=method,
        source=source,
        step=step,
    )

    if entry:
        derived = derive_recovery_policy(entry, payment_method=method)
        return {
            "provider": "razorpay",
            "matched": True,
            "raw": raw_normalized,
            "official": entry.to_dict(),
            "derived": derived,
        }

    # Unmapped / Unknown Error Handling
    derived_fallback = derive_recovery_policy(None, payment_method=method)
    return {
        "provider": "razorpay",
        "matched": False,
        "raw": raw_normalized,
        "official": None,
        "derived": derived_fallback,
    }
