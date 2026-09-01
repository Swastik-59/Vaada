from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password
from app.db.models import (
    AuditEvent,
    CaseState,
    CaseTransition,
    ComplianceCheck,
    Customer,
    Invoice,
    Membership,
    NoticeType,
    OutboundCommunication,
    PaymentEvent,
    PaymentReconciliation,
    PromiseToPay,
    RecoveryCase,
    RiskTier,
    Role,
    StatutoryNotice,
    Tenant,
    User,
    WorkflowActionRecord,
)
from app.services.ingestion import ingest_payment_event
from app.services.statutory import (
    calculate_43b_h_statutory_due_date,
    calculate_msme_statutory_interest,
    generate_statutory_notice_draft,
)


# ---------------------------------------------------------------------------
# Hinglish / messy reply samples used to populate PromiseToPay.raw_text
# These represent the extraction challenge that differentiates Vaada.
# ---------------------------------------------------------------------------
HINGLISH_REPLIES = [
    # Clean, easy
    "Sir, kal payment kar denge. 1.85 lakh bhej denge account mein by 4pm.",
    "We will clear INR 47,500 by 10th of this month. Please confirm receipt.",
    # Mixed script, high confidence
    "Haan ji, 2.3L clear ho jayega 15 tarikh ko. Pakka.",
    "Payment kal 11 baje tak ho jayegi. ₹94,000 bhej rahe hain NEFT se.",
    # Ambiguous / messy — these should trigger lower confidence or needs_review
    "kal pakka clear kar denge bhai, 1.8 lakh wali",
    "baat karo sir paise aa rahe hain",
    "15 ko hoga sab thik",
    "thoda time chahiye, next week pakka",
    # English with Indian context
    "We acknowledge the overdue amount. Will settle 2 lacs by month end.",
    "Payment will be processed by Friday. Amount approx 47K.",
]

# ---------------------------------------------------------------------------
# Seed cases definition — each dict describes one case to create
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Seed cases definition — each dict describes one case to create
# ---------------------------------------------------------------------------
SEED_CASES = [
    # --- Premier End-to-End Demo Case: ₹18,500 UPI failure + Hinglish promise ---
    dict(
        inv="INV-SYN-1004", cust_ref="CUST-SYN-004", cust_name="Kapoor Agri Inputs",
        amount=1850000, due_days_ago=5, failure_code="INSUFFICIENT_FUNDS",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="insufficient_funds",
        rzp_source="customer", rzp_step="payment_debit", payment_method="upi",
        rzp_description="The customer's bank account has insufficient balance to complete the transaction.",
        state="promise_recorded", prob=0.71823,
        promise=dict(
            raw_text="bhai abhi balance nahi hai, Friday tak pakka kar dunga",
            amount_minor=1850000,
            promised_days_from_now=4,
            confidence=0.94,
            language_mix="hinglish",
        ),
    ),
    # --- Straightforward cases in awaiting_action ---
    dict(
        inv="INV-SYN-1002", cust_ref="CUST-SYN-002", cust_name="Mehta Fabrics Pvt Ltd",
        amount=4750000, due_days_ago=14, failure_code="BANK_DECLINE",
        rzp_code="GATEWAY_ERROR", rzp_reason="bank_server_down",
        rzp_source="gateway", rzp_step="payment_authorization", payment_method="upi",
        rzp_description="The customer's bank core banking system or UPI switch is temporarily down for maintenance.",
        state="awaiting_action", prob=0.61234,
    ),
    dict(
        inv="INV-SYN-1003", cust_ref="CUST-SYN-003", cust_name="Sharma & Sons Exports",
        amount=9400000, due_days_ago=21, failure_code="MANDATE_FAILED",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="mandate_frequency_limit_exceeded",
        rzp_source="customer", rzp_step="payment_debit", payment_method="mandate",
        rzp_description="e-NACH / UPI Autopay recurring debit attempt exceeded the registered mandate frequency schedule.",
        state="awaiting_action", prob=0.38941,
    ),
    # --- Cases that have been contacted and are awaiting response ---
    dict(
        inv="INV-SYN-1005", cust_ref="CUST-SYN-005", cust_name="Gupta Steel Trading",
        amount=2340000, due_days_ago=18, failure_code="BANK_DECLINE",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="card_declined_by_bank",
        rzp_source="gateway", rzp_step="payment_authorization", payment_method="card",
        rzp_description="The card issuing bank declined the authorization request due to internal risk or credit limit breach.",
        state="awaiting_response", prob=0.29874,
        outbound=True,
    ),
    dict(
        inv="INV-SYN-1006", cust_ref="CUST-SYN-002", cust_name="Mehta Fabrics Pvt Ltd",
        amount=6800000, due_days_ago=30, failure_code="INVOICE_MISMATCH",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="card_expired",
        rzp_source="customer", rzp_step="payment_initiation", payment_method="card",
        rzp_description="The card expiry date provided is in the past, or the card has lapsed with the issuer.",
        state="awaiting_response", prob=0.44521,
        outbound=True,
    ),
    # --- Cases with a recorded promise (clean extraction) ---
    dict(
        inv="INV-SYN-1007", cust_ref="CUST-SYN-006", cust_name="Patel Paper Mills",
        amount=1875000, due_days_ago=10, failure_code="INSUFFICIENT_FUNDS",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="invalid_mpin",
        rzp_source="customer", rzp_step="payment_authentication", payment_method="upi",
        rzp_description="The customer entered an incorrect UPI PIN (MPIN) during authorization on their PSP app.",
        state="promise_recorded", prob=0.72318,
        promise=dict(
            raw_text=HINGLISH_REPLIES[0],
            amount_minor=185000,
            promised_days_from_now=1,
            confidence=0.88,
            language_mix="hinglish",
        ),
    ),
    dict(
        inv="INV-SYN-1008", cust_ref="CUST-SYN-007", cust_name="Agarwal Cold Chain",
        amount=4750000, due_days_ago=12, failure_code="NETWORK_ERROR",
        rzp_code="GATEWAY_ERROR", rzp_reason="network_error",
        rzp_source="gateway", rzp_step="payment_processing", payment_method="payment",
        rzp_description="Network connectivity between Razorpay and downstream payment aggregator interrupted.",
        state="promise_recorded", prob=0.81234,
        promise=dict(
            raw_text=HINGLISH_REPLIES[1],
            amount_minor=475000,
            promised_days_from_now=8,
            confidence=0.93,
            language_mix="english",
        ),
    ),
    dict(
        inv="INV-SYN-1009", cust_ref="CUST-SYN-008", cust_name="Nair Rubber Products",
        amount=2300000, due_days_ago=8, failure_code="INSUFFICIENT_FUNDS",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="insufficient_funds",
        rzp_source="customer", rzp_step="payment_debit", payment_method="upi",
        rzp_description="The customer's bank account has insufficient balance to complete the transaction.",
        state="promise_recorded", prob=0.68912,
        promise=dict(
            raw_text=HINGLISH_REPLIES[2],
            amount_minor=230000,
            promised_days_from_now=13,
            confidence=0.81,
            language_mix="hinglish",
        ),
    ),
    dict(
        inv="INV-SYN-1010", cust_ref="CUST-SYN-009", cust_name="Reddy Textiles Ltd",
        amount=940000, due_days_ago=6, failure_code="MANDATE_FAILED",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="mandate_cancelled",
        rzp_source="customer", rzp_step="payment_initiation", payment_method="mandate",
        rzp_description="The recurring e-Mandate was revoked or cancelled by the customer.",
        state="promise_recorded", prob=0.74123,
        promise=dict(
            raw_text=HINGLISH_REPLIES[3],
            amount_minor=94000,
            promised_days_from_now=1,
            confidence=0.86,
            language_mix="hinglish",
        ),
    ),
    # --- Cases in human_review (messy extraction or low probability) ---
    dict(
        inv="INV-SYN-1011", cust_ref="CUST-SYN-010", cust_name="Joshi Auto Parts",
        amount=7200000, due_days_ago=45, failure_code="CUSTOMER_DISPUTE",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="vpa_blocked",
        rzp_source="customer", rzp_step="payment_initiation", payment_method="upi",
        rzp_description="The customer's VPA / UPI ID has been blocked or restricted due to risk rules.",
        state="human_review", prob=0.18234,
    ),
    dict(
        inv="INV-SYN-1012", cust_ref="CUST-SYN-003", cust_name="Sharma & Sons Exports",
        amount=3100000, due_days_ago=25, failure_code="BANK_DECLINE",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="netbanking_session_expired",
        rzp_source="customer", rzp_step="payment_authorization", payment_method="netbanking",
        rzp_description="The customer's netbanking portal session timed out prior to transaction submission.",
        state="human_review", prob=0.22671,
        promise=dict(
            raw_text=HINGLISH_REPLIES[4],
            amount_minor=180000,
            promised_days_from_now=1,
            confidence=0.51,
            language_mix="hinglish",
            extraction_failure="low_confidence",
        ),
    ),
    dict(
        inv="INV-SYN-1013", cust_ref="CUST-SYN-006", cust_name="Patel Paper Mills",
        amount=5600000, due_days_ago=60, failure_code="INSUFFICIENT_FUNDS",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="insufficient_funds",
        rzp_source="customer", rzp_step="payment_debit", payment_method="upi",
        state="human_review", prob=0.09123,
        promise=dict(
            raw_text=HINGLISH_REPLIES[5],
            amount_minor=0,
            promised_days_from_now=7,
            confidence=0.34,
            language_mix="hinglish",
            extraction_failure="incomplete",
        ),
    ),
    dict(
        inv="INV-SYN-1014", cust_ref="CUST-SYN-007", cust_name="Agarwal Cold Chain",
        amount=1200000, due_days_ago=20, failure_code="INVOICE_MISMATCH",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="card_declined_by_bank",
        rzp_source="gateway", rzp_step="payment_authorization", payment_method="card",
        state="human_review", prob=0.31456,
        promise=dict(
            raw_text=HINGLISH_REPLIES[6],
            amount_minor=0,
            promised_days_from_now=14,
            confidence=0.42,
            language_mix="hindi",
            extraction_failure="incomplete",
        ),
    ),
    # --- Paused cases ---
    dict(
        inv="INV-SYN-1015", cust_ref="CUST-SYN-008", cust_name="Nair Rubber Products",
        amount=880000, due_days_ago=9, failure_code="NETWORK_ERROR",
        rzp_code="GATEWAY_ERROR", rzp_reason="payment_timed_out",
        rzp_source="gateway", rzp_step="payment_processing", payment_method="upi",
        state="paused", prob=0.65421,
    ),
    # --- Compliance-blocked case ---
    dict(
        inv="INV-SYN-1016", cust_ref="CUST-SYN-010", cust_name="Joshi Auto Parts",
        amount=2750000, due_days_ago=3, failure_code="INSUFFICIENT_FUNDS",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="insufficient_funds",
        rzp_source="customer", rzp_step="payment_debit", payment_method="upi",
        state="blocked", prob=0.58234,
        compliance_blocked=True,
    ),
    # --- Recovered cases (wires the amount counter) ---
    dict(
        inv="INV-SYN-1017", cust_ref="CUST-SYN-009", cust_name="Reddy Textiles Ltd",
        amount=3400000, due_days_ago=28, failure_code="MANDATE_FAILED",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="mandate_frequency_limit_exceeded",
        rzp_source="customer", rzp_step="payment_debit", payment_method="mandate",
        state="recovered", prob=0.77123,
        promise=dict(
            raw_text=HINGLISH_REPLIES[8],
            amount_minor=340000,
            promised_days_from_now=-5,
            confidence=0.91,
            language_mix="english",
        ),
    ),
    dict(
        inv="INV-SYN-1018", cust_ref="CUST-SYN-002", cust_name="Mehta Fabrics Pvt Ltd",
        amount=1950000, due_days_ago=35, failure_code="INSUFFICIENT_FUNDS",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="insufficient_funds",
        rzp_source="customer", rzp_step="payment_debit", payment_method="upi",
        state="recovered", prob=0.82341,
        promise=dict(
            raw_text=HINGLISH_REPLIES[9],
            amount_minor=195000,
            promised_days_from_now=-3,
            confidence=0.78,
            language_mix="english",
        ),
    ),
    # --- Unrecoverable / Unmapped Case Demo ---
    dict(
        inv="INV-SYN-1019", cust_ref="CUST-SYN-005", cust_name="Gupta Steel Trading",
        amount=8900000, due_days_ago=90, failure_code="CUSTOMER_DISPUTE",
        rzp_code="GATEWAY_ERROR", rzp_reason="unmapped_bank_anomaly_99",
        rzp_source="gateway", rzp_step="payment_processing", payment_method="upi",
        rzp_description="Exotic downstream banking switch response code 99.",
        state="unrecoverable", prob=0.04123,
    ),
    # --- Another awaiting_action with compliance pass seeded ---
    dict(
        inv="INV-SYN-1020", cust_ref="CUST-SYN-004", cust_name="Kapoor Agri Inputs",
        amount=5100000, due_days_ago=11, failure_code="MANDATE_FAILED",
        rzp_code="BAD_REQUEST_ERROR", rzp_reason="mandate_cancelled",
        rzp_source="customer", rzp_step="payment_initiation", payment_method="mandate",
        state="awaiting_action", prob=0.54892,
        compliance_passed=True,
    ),
    # --- Messy reply in awaiting_response ---
    dict(
        inv="INV-SYN-1021", cust_ref="CUST-SYN-010", cust_name="Joshi Auto Parts",
        amount=660000, due_days_ago=4, failure_code="INSUFFICIENT_FUNDS",
        state="awaiting_response", prob=0.69231,
        outbound=True,
    ),
]

# Maps state strings to the multi-hop transition sequence needed to get there.
# Each entry: list of (to_state, reason, actor_type) tuples from the *classified* state.
_STATE_PATHS: dict[str, list[tuple[str, str, str]]] = {
    "awaiting_action": [
        ("awaiting_action", "Case scored and queued for a compliant recovery action.", "system"),
    ],
    "awaiting_response": [
        ("awaiting_action", "Case scored and queued for a compliant recovery action.", "system"),
        ("contacted", "Reminder sent after compliance clearance.", "user"),
        ("awaiting_response", "Awaiting customer reply.", "system"),
    ],
    "promise_recorded": [
        ("awaiting_action", "Case scored and queued for a compliant recovery action.", "system"),
        ("contacted", "Reminder sent after compliance clearance.", "user"),
        ("awaiting_response", "Awaiting customer reply.", "system"),
        ("promise_recorded", "Validated promise-to-pay recorded.", "llm"),
    ],
    "human_review": [
        ("human_review", "Recovery probability below automated-contact threshold.", "system"),
    ],
    "paused": [
        ("awaiting_action", "Case scored and queued for a compliant recovery action.", "system"),
        ("paused", "Operator paused automated contact pending internal escalation.", "user"),
    ],
    "blocked": [
        ("awaiting_action", "Case scored and queued for a compliant recovery action.", "system"),
        ("blocked", "Compliance blocked outbound contact outside the contact window.", "user"),
    ],
    "recovered": [
        ("awaiting_action", "Case scored and queued for a compliant recovery action.", "system"),
        ("contacted", "Reminder sent after compliance clearance.", "user"),
        ("awaiting_response", "Awaiting customer reply.", "system"),
        ("promise_recorded", "Validated promise-to-pay recorded.", "llm"),
        ("recovered", "Promise honoured; payment confirmed by operator.", "user"),
    ],
    "unrecoverable": [
        ("human_review", "Recovery probability below automated-contact threshold.", "system"),
        ("unrecoverable", "Case closed as unrecoverable after human review.", "user"),
    ],
}


CUSTOMER_INDIAN_PROFILES = {
    "CUST-SYN-001": dict(gstin="27AABCS1429B1Z8", pan="AABCS1429B", is_msme=True, cat="Micro", udyam="UDYAM-MH-01-0012345", phone="+919820198765"),
    "CUST-SYN-002": dict(gstin="24AAACM4582D1ZY", pan="AAACM4582D", is_msme=True, cat="Small", udyam="UDYAM-GJ-02-0045821", phone="+919879012345"),
    "CUST-SYN-003": dict(gstin="07AAACS7812E1ZQ", pan="AAACS7812E", is_msme=False, cat=None, udyam=None, phone="+919811098765"),
    "CUST-SYN-004": dict(gstin="08AAACK9021K1ZW", pan="AAACK9021K", is_msme=True, cat="Micro", udyam="UDYAM-RJ-03-0090211", phone="+919414012345"),
    "CUST-SYN-005": dict(gstin="29AAACG3341H1Z6", pan="AAACG3341H", is_msme=True, cat="Small", udyam="UDYAM-KA-04-0033419", phone="+919845012345"),
    "CUST-SYN-006": dict(gstin="24AAACP6712P1ZB", pan="AAACP6712P", is_msme=True, cat="Small", udyam="UDYAM-GJ-02-0067124", phone="+919825098765"),
    "CUST-SYN-007": dict(gstin="27AAACA1190A1ZF", pan="AAACA1190A", is_msme=True, cat="Medium", udyam="UDYAM-MH-01-0011903", phone="+919821012345"),
    "CUST-SYN-008": dict(gstin="36AAACB8843R1ZK", pan="AAACB8843R", is_msme=True, cat="Micro", udyam="UDYAM-TS-05-0088432", phone="+919849098765"),
    "CUST-SYN-009": dict(gstin="33AAACD5521L1ZM", pan="AAACD5521L", is_msme=False, cat=None, udyam=None, phone="+919840012345"),
    "CUST-SYN-010": dict(gstin="19AAACZ2219K1ZS", pan="AAACZ2219K", is_msme=True, cat="Micro", udyam="UDYAM-WB-06-0022198", phone="+919830098765"),
}


def _get_or_create_customer(db: Session, tenant_id: str, ref: str, name: str) -> Customer:
    existing = db.query(Customer).filter_by(tenant_id=tenant_id, external_ref=ref).one_or_none()
    if existing:
        return existing
    profile = CUSTOMER_INDIAN_PROFILES.get(ref, dict(
        gstin="27AAACX9999X1Z1", pan="AAACX9999X", is_msme=True, cat="Micro",
        udyam="UDYAM-MH-01-0099999", phone="+919820000000",
    ))
    cust = Customer(
        tenant_id=tenant_id,
        external_ref=ref,
        display_name=name,
        contact_channel="whatsapp",
        contact_value=f"accounts@{ref.lower().replace('cust-syn-', 'buyer')}.example",
        gstin=profile.get("gstin"),
        pan=profile.get("pan"),
        is_msme=profile.get("is_msme", False),
        msme_category=profile.get("cat"),
        udyam_reg_number=profile.get("udyam"),
        phone_number=profile.get("phone"),
    )
    db.add(cust)
    db.flush()
    return cust


def _advance_case(
    db: Session,
    case: RecoveryCase,
    target_state: str,
    tenant_id: str,
    base_time: datetime,
) -> None:
    """Walk a case through the state machine to reach target_state."""
    path = _STATE_PATHS.get(target_state, [])
    for i, (to_state, reason, actor_type) in enumerate(path):
        allowed = {
            "open": {"classified"},
            "classified": {"awaiting_action", "human_review"},
            "awaiting_action": {"contacted", "paused", "blocked", "human_review"},
            "contacted": {"awaiting_response", "paused", "human_review"},
            "awaiting_response": {"promise_recorded", "human_review", "awaiting_action"},
            "promise_recorded": {"recovered", "awaiting_action", "human_review"},
            "human_review": {"awaiting_action", "paused", "recovered", "unrecoverable", "cancelled"},
            "paused": {"awaiting_action", "cancelled"},
            "blocked": {"human_review", "awaiting_action"},
            "recovered": set(),
            "unrecoverable": set(),
            "cancelled": set(),
        }
        if to_state not in allowed.get(case.state, set()):
            continue
        transition_at = base_time + timedelta(hours=i * 6 + 1)
        record = CaseTransition(
            tenant_id=tenant_id,
            case_id=case.id,
            from_state=case.state,
            to_state=to_state,
            reason=reason,
            actor_type=actor_type,
            correlation_id="seed-demo",
        )
        case.state = to_state
        case.version += 1
        db.add(record)
        db.add(AuditEvent(
            tenant_id=tenant_id,
            actor_type=actor_type,
            action="case.transitioned",
            resource_type="recovery_case",
            resource_id=case.id,
            correlation_id="seed-demo",
            payload_json=json.dumps({"from": record.from_state, "to": to_state, "reason": reason}),
        ))
    db.flush()


def _seed_single_case(db: Session, tenant: Tenant, spec: dict, admin_id: str) -> None:
    inv_num = spec["inv"]
    # Idempotent: skip if already seeded
    if db.query(Invoice).filter_by(tenant_id=tenant.id, invoice_number=inv_num).one_or_none():
        return

    now = datetime.now(UTC)
    due_at = now - timedelta(days=spec["due_days_ago"])
    issued_at = due_at - timedelta(days=30)
    base_time = due_at + timedelta(hours=2)

    cust = _get_or_create_customer(db, tenant.id, spec["cust_ref"], spec["cust_name"])

    statutory_due = calculate_43b_h_statutory_due_date(issued_at, agreement_exists=True)
    invoice = Invoice(
        tenant_id=tenant.id,
        customer_id=cust.id,
        invoice_number=inv_num,
        amount_minor=spec["amount"],
        currency="INR",
        issued_at=issued_at,
        due_at=due_at,
        statutory_due_date=statutory_due,
        status="overdue",
        e_invoice_irn=f"IRN{inv_num.replace('-', '')}9876543210ABCDEF",
    )
    db.add(invoice)
    db.flush()

    # Construct structured Razorpay error payload preserving raw schema
    rzp_payload = {
        "error": {
            "code": spec.get("rzp_code", "BAD_REQUEST_ERROR"),
            "reason": spec.get("rzp_reason", spec["failure_code"].lower()),
            "source": spec.get("rzp_source", "customer"),
            "step": spec.get("rzp_step", "payment_initiation"),
            "description": spec.get("rzp_description", f"Payment failed with code {spec['failure_code']}"),
            "payment_method": spec.get("payment_method", "upi"),
            "metadata": {
                "payment_id": f"pay_{inv_num.replace('-', '')}",
                "order_id": f"order_{inv_num.replace('-', '')}",
            },
        },
        "payment_method": spec.get("payment_method", "upi"),
        "failure_code": spec["failure_code"],
        "channel": "seed",
    }

    # Ingest the payment event — this runs taxonomy normalization + score + creates the case
    _event, case, _dup = ingest_payment_event(
        db,
        tenant=tenant,
        source="razorpay" if spec.get("rzp_code") else "synthetic",
        provider_event_id=f"RZP-EVT-{inv_num}",
        invoice=invoice,
        event_type="payment.failed",
        payload=rzp_payload,
        occurred_at=base_time,
        failure_code=spec["failure_code"],
        note=None,
        correlation_id="seed-demo",
    )
    if case is None:
        return

    # Calculate statutory compound interest & risk tier
    interest_minor, _ = calculate_msme_statutory_interest(
        invoice.amount_minor,
        issued_at=issued_at,
        now=now,
    )
    case.statutory_interest_minor = interest_minor
    case.credit_risk_tier = (
        RiskTier.CRITICAL.value if (spec["due_days_ago"] >= 45 or spec.get("state") == "unrecoverable")
        else (RiskTier.HIGH.value if spec["due_days_ago"] >= 25 or spec.get("state") in {"human_review", "blocked"}
        else (RiskTier.MEDIUM.value if spec["due_days_ago"] >= 10 else RiskTier.LOW.value))
    )

    # Override recovery probability with the seeded value for demo determinism
    if spec.get("prob") is not None:
        case.recovery_probability = spec["prob"]

    # Advance the case through the state machine
    target_state = spec.get("state", "awaiting_action")
    _advance_case(db, case, target_state, tenant.id, base_time)
    db.flush()

    # Pre-generate statutory notices for high-DPD cases
    if spec["due_days_ago"] >= 40 and cust.is_msme:
        notice_draft = generate_statutory_notice_draft(
            NoticeType.MSME_43B_H,
            tenant=tenant,
            customer=cust,
            invoice=invoice,
            now=now,
        )
        db.add(StatutoryNotice(
            tenant_id=tenant.id,
            case_id=case.id,
            notice_type=NoticeType.MSME_43B_H.value,
            title=notice_draft["title"],
            recipient_name=notice_draft["recipient_name"],
            recipient_contact=notice_draft["recipient_contact"],
            content_markdown=notice_draft["content_markdown"],
            statutory_reference=notice_draft["statutory_reference"],
            claim_amount_minor=notice_draft["claim_amount_minor"],
            statutory_interest_minor=notice_draft["statutory_interest_minor"],
            cure_period_days=notice_draft["cure_period_days"],
            status="generated",
        ))
    elif spec["failure_code"] in {"MANDATE_FAILED", "BANK_DECLINE"} and spec["due_days_ago"] >= 20:
        notice_draft = generate_statutory_notice_draft(
            NoticeType.SEC_138_NI_ACT,
            tenant=tenant,
            customer=cust,
            invoice=invoice,
            now=now,
        )
        db.add(StatutoryNotice(
            tenant_id=tenant.id,
            case_id=case.id,
            notice_type=NoticeType.SEC_138_NI_ACT.value,
            title=notice_draft["title"],
            recipient_name=notice_draft["recipient_name"],
            recipient_contact=notice_draft["recipient_contact"],
            content_markdown=notice_draft["content_markdown"],
            statutory_reference=notice_draft["statutory_reference"],
            claim_amount_minor=notice_draft["claim_amount_minor"],
            statutory_interest_minor=notice_draft["statutory_interest_minor"],
            cure_period_days=notice_draft["cure_period_days"],
            status="generated",
        ))

    # Seed outbound communication if needed
    if spec.get("outbound") or spec.get("compliance_blocked") or spec.get("compliance_passed"):
        legal_name = tenant.legal_name
        rupees = invoice.amount_minor / 100
        message = (
            f"{legal_name} is writing about overdue invoice {invoice.invoice_number} "
            f"for INR {rupees:.2f}. Please confirm when payment will be made. "
            "This message is intended only for the authorised billing contact."
        )
        blocked = bool(spec.get("compliance_blocked"))
        db.add(OutboundCommunication(
            tenant_id=tenant.id,
            case_id=case.id,
            channel="email",
            body=message,
            blocked=blocked,
        ))
        if spec.get("compliance_action"):
            db.add(WorkflowActionRecord(
                tenant_id=tenant.id,
                case_id=case.id,
                action_type="send_reminder",
                status="blocked" if blocked else "executed",
                reason="outside_contact_window" if blocked else "Compliant reminder queued for the authorised billing contact.",
                actor_type="user",
                actor_id=admin_id,
                correlation_id="seed-demo",
            ))

        # Build compliance check result
        import time as _time
        _local_hour = 10  # simulate a 10am IST check for pass; 22:00 for blocked
        if blocked:
            results = [
                {"rule_id": "contact_window", "title": "Contact window", "passed": False,
                 "detail": "Blocked: local time Sunday 22:15 IST is outside the contact window."},
                {"rule_id": "frequency_limit", "title": "Frequency limit", "passed": True,
                 "detail": "0 of 3 contacts used in 7 days."},
                {"rule_id": "tone_guardrail", "title": "Tone guardrail", "passed": True,
                 "detail": "No prohibited coercive language detected."},
                {"rule_id": "disclosure_guard", "title": "Disclosure guard", "passed": True,
                 "detail": "Message is addressed through an authorised customer channel."},
                {"rule_id": "identity_requirement", "title": "Identity requirement", "passed": True,
                 "detail": "Sending organisation is identified."},
            ]
            failed_ids = "contact_window"
            decision = "BLOCK"
        else:
            results = [
                {"rule_id": "contact_window", "title": "Contact window", "passed": True,
                 "detail": "Outbound contact is permitted 09:00–20:00 IST, Monday–Saturday."},
                {"rule_id": "frequency_limit", "title": "Frequency limit", "passed": True,
                 "detail": "0 of 3 contacts used in 7 days."},
                {"rule_id": "tone_guardrail", "title": "Tone guardrail", "passed": True,
                 "detail": "No prohibited coercive language detected."},
                {"rule_id": "disclosure_guard", "title": "Disclosure guard", "passed": True,
                 "detail": "Message is addressed through an authorised customer channel."},
                {"rule_id": "identity_requirement", "title": "Identity requirement", "passed": True,
                 "detail": "Sending organisation is identified."},
            ]
            failed_ids = ""
            decision = "ALLOW"

        db.add(ComplianceCheck(
            tenant_id=tenant.id,
            case_id=case.id,
            action_type="send_reminder",
            decision=decision,
            results_json=json.dumps(results),
            failed_rule_ids=failed_ids,
        ))

    # Seed PromiseToPay if specified
    if promise := spec.get("promise"):
        promised_dt = datetime.combine(
            date.today() + timedelta(days=promise["promised_days_from_now"]),
            datetime.min.time(),
            tzinfo=UTC,
        )
        db.add(PromiseToPay(
            tenant_id=tenant.id,
            case_id=case.id,
            amount_minor=promise["amount_minor"],
            promised_date=promised_dt,
            confidence=promise["confidence"],
            raw_text=promise["raw_text"],
            language_mix=promise["language_mix"],
            status="recorded" if not promise.get("extraction_failure") else "needs_review",
            extraction_failure=promise.get("extraction_failure"),
        ))

    db.flush()


def seed_demo(db: Session, settings: Settings) -> dict[str, str]:
    if not settings.seed_admin_password:
        raise RuntimeError("VAADA_SEED_ADMIN_PASSWORD must be set to seed demo data.")

    # --- Tenant ---
    tenant = db.query(Tenant).filter_by(slug="northwind-textiles").one_or_none()
    if tenant is None:
        tenant = Tenant(
            slug="northwind-textiles",
            name="Northwind Textiles Pvt Ltd",
            legal_name="Northwind Textiles Private Limited",
        )
        db.add(tenant)
        db.flush()

    # --- Admin user ---
    admin = db.query(User).filter_by(email=settings.seed_admin_email.lower()).one_or_none()
    password_hash = hash_password(settings.seed_admin_password)
    if admin is None:
        admin = User(
            email=settings.seed_admin_email.lower(),
            password_hash=password_hash,
            is_active=True,
        )
        db.add(admin)
        db.flush()
    else:
        admin.password_hash = password_hash
        admin.is_active = True

    if db.query(Membership).filter_by(user_id=admin.id, tenant_id=tenant.id).one_or_none() is None:
        db.add(Membership(user_id=admin.id, tenant_id=tenant.id, role=Role.MANAGER.value))

    # --- Viewer user ---
    viewer = db.query(User).filter_by(email="viewer@vaada.local").one_or_none()
    if viewer is None:
        viewer = User(
            email="viewer@vaada.local",
            password_hash=password_hash,
            is_active=True,
        )
        db.add(viewer)
        db.flush()
        db.add(Membership(user_id=viewer.id, tenant_id=tenant.id, role=Role.VIEWER.value))
    else:
        viewer.password_hash = password_hash
        viewer.is_active = True

    db.flush()

    # --- Original single case (kept for backward compat) ---
    original_cust = db.query(Customer).filter_by(tenant_id=tenant.id, external_ref="CUST-SYN-001").one_or_none()
    if original_cust is None:
        original_cust = Customer(
            tenant_id=tenant.id,
            external_ref="CUST-SYN-001",
            display_name="Synthetic Buyer Co",
            contact_channel="email",
            contact_value="accounts@synthetic-buyer.example",
        )
        db.add(original_cust)
        db.flush()

    invoice_orig = db.query(Invoice).filter_by(tenant_id=tenant.id, invoice_number="INV-SYN-1001").one_or_none()
    if invoice_orig is None:
        now = datetime.now(UTC)
        invoice_orig = Invoice(
            tenant_id=tenant.id,
            customer_id=original_cust.id,
            invoice_number="INV-SYN-1001",
            amount_minor=18500000,
            currency="INR",
            issued_at=now - timedelta(days=21),
            due_at=now - timedelta(days=7),
            status="overdue",
        )
        db.add(invoice_orig)
        db.flush()
        ingest_payment_event(
            db,
            tenant=tenant,
            source="synthetic",
            provider_event_id="SYN-EVT-1001",
            invoice=invoice_orig,
            event_type="payment.failed",
            payload={"failure_code": "INSUFFICIENT_FUNDS", "channel": "seed"},
            occurred_at=datetime.now(UTC),
            failure_code="INSUFFICIENT_FUNDS",
            note=None,
            correlation_id="seed-demo",
        )

    # --- 20 additional synthetic cases ---
    for spec in SEED_CASES:
        _seed_single_case(db, tenant, spec, admin_id=admin.id)

    db.flush()
    return {"tenant_id": tenant.id, "invoice_id": invoice_orig.id, "admin_email": admin.email}


def main() -> None:
    from app.core.config import get_settings
    from app.db.models import Base
    from app.db.session import _engine_url, create_engine_from_settings, session_factory

    settings = get_settings()
    if ":memory:" in settings.database_url:
        raise RuntimeError(
            "Refusing to seed an in-memory database. Unset VAADA_DATABASE_URL "
            "so the repository-root .env file is used."
        )
    engine = create_engine_from_settings(settings)
    Base.metadata.create_all(bind=engine)
    db = session_factory(engine)()
    try:
        result = seed_demo(db, settings)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    print(f"Seeded local operator {result['admin_email']}")
    print(f"Database: {_engine_url(settings)}")
    print("Sign in with that email and VAADA_SEED_ADMIN_PASSWORD from the repository-root .env")


if __name__ == "__main__":
    main()
