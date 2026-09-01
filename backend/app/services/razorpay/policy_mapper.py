from __future__ import annotations

from typing import Any

from app.services.razorpay.taxonomy import TaxonomyEntry

# Mapping table of known Razorpay reasons to derived recovery logic
# NOTE: This is Vaada's internal product intelligence, separated from official Razorpay data.
DERIVED_POLICY_TABLE: dict[str, dict[str, Any]] = {
    "insufficient_funds": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "medium",
        "recommended_customer_action": "Check bank balance and retry payment or select an alternate bank account.",
        "recommended_merchant_action": "Send instant UPI Intent link and allow flexible installment option if required.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "SEND_RETRY_PROMPT",
    },
    "invalid_vpa": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "medium",
        "recommended_customer_action": "Verify and provide a valid active VPA / UPI ID.",
        "recommended_merchant_action": "Deliver dynamic UPI QR code or dedicated corporate VAN to bypass manual VPA input.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "DISPATCH_DYNAMIC_QR",
    },
    "invalid_mpin": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "low",
        "recommended_customer_action": "Re-enter the correct UPI PIN on the PSP mobile application.",
        "recommended_merchant_action": "Trigger automated instant retry notification.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "SEND_RETRY_PROMPT",
    },
    "payment_cancelled_by_user": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "high",
        "recommended_customer_action": "Review outstanding commercial invoice and approve payment request.",
        "recommended_merchant_action": "Initiate automated conversational check-in to identify commercial or delivery disputes.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "ENGAGE_FOR_DISPUTE_OR_PROMISE",
    },
    "transaction_exceeds_limit": {
        "recoverability": "recoverable",
        "retryable": False,
        "urgency": "medium",
        "recommended_customer_action": "Request bank to raise daily UPI limit or settle via NEFT/RTGS.",
        "recommended_merchant_action": "Provide corporate Virtual Account Number (VAN) for direct RTGS/NEFT settlement.",
        "preferred_channel": "email",
        "requires_human_review": False,
        "policy_decision": "SWITCH_TO_CORPORATE_VAN",
    },
    "vpa_blocked": {
        "recoverability": "needs_investigation",
        "retryable": False,
        "urgency": "high",
        "recommended_customer_action": "Contact issuing bank to unblock UPI service.",
        "recommended_merchant_action": "Provide alternate NEFT/RTGS payment details and flag for operator monitoring.",
        "preferred_channel": "email",
        "requires_human_review": True,
        "policy_decision": "FLAG_FOR_OPERATOR_REVIEW",
    },
    "exceeded_daily_limit": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "low",
        "recommended_customer_action": "Wait for 24-hour limit reset or execute bank transfer.",
        "recommended_merchant_action": "Schedule automatic payment reminder for next business morning.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "SCHEDULE_NEXT_DAY_RETRY",
    },
    "bank_server_down": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "low",
        "recommended_customer_action": "Retry payment in 15-30 minutes.",
        "recommended_merchant_action": "Hold automated escalation until bank gateway downtime clears.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "TRANSIENT_BACKOFF_HOLD",
    },
    "payment_timed_out": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "medium",
        "recommended_customer_action": "Approve the UPI collect notification promptly when triggered.",
        "recommended_merchant_action": "Send fresh high-speed dynamic UPI intent push notification.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "RETRIGGER_INTENT_FLOW",
    },
    "card_expired": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "medium",
        "recommended_customer_action": "Enter updated credit/debit card details or pay via UPI.",
        "recommended_merchant_action": "Send multi-rail checkout link supporting instant UPI and Corporate Netbanking.",
        "preferred_channel": "email",
        "requires_human_review": False,
        "policy_decision": "SEND_MULTI_RAIL_LINK",
    },
    "card_declined_by_bank": {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "medium",
        "recommended_customer_action": "Enable online transactions in banking app or use another card/rail.",
        "recommended_merchant_action": "Send payment link with UPI and Netbanking pre-selected.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "SEND_MULTI_RAIL_LINK",
    },
    "mandate_cancelled": {
        "recoverability": "unrecoverable",
        "retryable": False,
        "urgency": "high",
        "recommended_customer_action": "Re-authorize e-Mandate or process manual settlement.",
        "recommended_merchant_action": "Escalate to account manager; issue formal statement of account.",
        "preferred_channel": "email",
        "requires_human_review": True,
        "policy_decision": "ESCALATE_MANDATE_CANCELLATION",
    },
}


def derive_recovery_policy(
    entry: TaxonomyEntry | None,
    payment_method: str | None = None,
) -> dict[str, Any]:
    """
    Derive Vaada recovery intelligence from an official Razorpay taxonomy entry.
    Strictly separates derived intelligence from official documentation.
    """
    if not entry:
        return {
            "recoverability": "needs_investigation",
            "retryable": False,
            "urgency": "high",
            "recommended_customer_action": "Please contact customer support regarding payment status.",
            "recommended_merchant_action": "Review unmapped payment error payload and verify gateway logs.",
            "preferred_channel": "email",
            "requires_human_review": True,
            "policy_decision": "FLAG_UNMAPPED_ERROR_FOR_OPERATOR",
            "is_unmapped": True,
        }

    reason_key = entry.reason.lower()
    if reason_key in DERIVED_POLICY_TABLE:
        base = dict(DERIVED_POLICY_TABLE[reason_key])
        base["is_unmapped"] = False
        return base

    # Default heuristic based on source and category
    if entry.source == "gateway" or entry.code == "GATEWAY_ERROR":
        return {
            "recoverability": "recoverable",
            "retryable": True,
            "urgency": "low",
            "recommended_customer_action": "Transient banking gateway error; please retry shortly.",
            "recommended_merchant_action": "Allow gateway transient retry window.",
            "preferred_channel": "whatsapp",
            "requires_human_review": False,
            "policy_decision": "TRANSIENT_BACKOFF_HOLD",
            "is_unmapped": False,
        }

    if entry.source == "business":
        return {
            "recoverability": "needs_investigation",
            "retryable": False,
            "urgency": "high",
            "recommended_customer_action": "Payment configuration error; merchant will update payment link.",
            "recommended_merchant_action": "Verify API integration parameters and payment options.",
            "preferred_channel": "email",
            "requires_human_review": True,
            "policy_decision": "FLAG_INTEGRATION_ERROR",
            "is_unmapped": False,
        }

    return {
        "recoverability": "recoverable",
        "retryable": True,
        "urgency": "medium",
        "recommended_customer_action": "Retry payment using alternative payment method if issue persists.",
        "recommended_merchant_action": "Deliver payment link with interactive WhatsApp/UPI rails.",
        "preferred_channel": "whatsapp",
        "requires_human_review": False,
        "policy_decision": "SEND_RETRY_PROMPT",
        "is_unmapped": False,
    }


def evaluate_combined_case_decision(
    *,
    taxonomy_entry: TaxonomyEntry | None,
    raw_payload: dict[str, Any],
    customer_message: str | None = None,
    promise_to_pay: dict[str, Any] | None = None,
    broken_p2p_count: int = 0,
    statutory_days_remaining: int | None = None,
) -> dict[str, Any]:
    """
    Core differentiator: Combines Razorpay authoritative diagnosis + customer Hinglish context
    + statutory constraints into a unified, transparent decision trace.
    """
    derived = derive_recovery_policy(taxonomy_entry)
    trace_steps: list[dict[str, Any]] = []

    # Step 1: Payment Failure Ingested
    err_code = (
        taxonomy_entry.code
        if taxonomy_entry
        else raw_payload.get("code") or raw_payload.get("error", {}).get("code", "UNKNOWN_ERROR")
    )
    err_reason = (
        taxonomy_entry.reason
        if taxonomy_entry
        else raw_payload.get("reason") or raw_payload.get("error", {}).get("reason", "unknown")
    )
    trace_steps.append({
        "stage": "PAYMENT_FAILURE",
        "label": "Payment Failure Event Received",
        "details": f"Code: {err_code} • Reason: {err_reason}",
    })

    # Step 2: Razorpay Taxonomy Match
    if taxonomy_entry:
        trace_steps.append({
            "stage": "TAXONOMY_MATCH",
            "label": "Authoritative Razorpay Taxonomy Matched",
            "details": f"Source: {taxonomy_entry.source} • Step: {taxonomy_entry.step} • URL: {taxonomy_entry.official_source_url}",
        })
        trace_steps.append({
            "stage": "OFFICIAL_GUIDANCE",
            "label": "Razorpay Official Next Step",
            "details": taxonomy_entry.official_next_step,
        })
    else:
        trace_steps.append({
            "stage": "TAXONOMY_UNMAPPED",
            "label": "Unmapped Razorpay Error",
            "details": "Payload did not match published taxonomy records. Flagged for human review.",
        })

    # Step 3: Customer Interaction & Promise Reasoning
    final_policy = derived["policy_decision"]
    final_action = derived["recommended_merchant_action"]
    confidence = 0.85

    if customer_message and customer_message.strip():
        trace_steps.append({
            "stage": "CUSTOMER_MESSAGE",
            "label": "Customer Hinglish Reply Ingested",
            "details": f'"{customer_message.strip()}"',
        })

        if promise_to_pay and promise_to_pay.get("promised_date"):
            promised_dt_str = str(promise_to_pay.get("promised_date"))
            p_conf = float(promise_to_pay.get("confidence", 0.9))
            confidence = p_conf

            if broken_p2p_count > 0:
                final_policy = "ESCALATE_REPEATED_BROKEN_PROMISE"
                final_action = "Broken promise threshold exceeded. Send Statutory MSME Notice & escalate."
                trace_steps.append({
                    "stage": "PROMISE_BROKEN",
                    "label": "Broken Commitment Penalty",
                    "details": f"Prior broken promises: {broken_p2p_count}. Escalating to formal statutory notice.",
                })
            else:
                final_policy = "WAIT_FOR_PROMISED_DATE"
                final_action = f"Honor customer commitment; schedule automatic T-1 reminder for {promised_dt_str}."
                trace_steps.append({
                    "stage": "PROMISE_DETECTED",
                    "label": "Promise-to-Pay Validated",
                    "details": f"Commitment Date: {promised_dt_str} (Confidence: {int(p_conf * 100)}%)",
                })

    # Step 4: Statutory Risk Modifiers
    if statutory_days_remaining is not None and statutory_days_remaining <= 5:
        trace_steps.append({
            "stage": "STATUTORY_WARNING",
            "label": "Section 43B(h) Clock Critical",
            "details": f"Only {statutory_days_remaining} days remaining before tax deduction disallowance.",
        })

    # Step 5: Final Policy Decision
    trace_steps.append({
        "stage": "RECOVERY_POLICY",
        "label": "Recovery Policy Selected",
        "details": f"Policy: {final_policy} • Action: {final_action}",
    })

    return {
        "final_policy": final_policy,
        "recommended_action": final_action,
        "confidence": confidence,
        "recoverability": derived["recoverability"],
        "retryable": derived["retryable"],
        "urgency": derived["urgency"],
        "requires_human_review": derived["requires_human_review"],
        "decision_trace_chain": trace_steps,
    }
