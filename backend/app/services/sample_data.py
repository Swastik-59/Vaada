from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
import random

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.models import (
    ActorType,
    AuditEvent,
    CaseState,
    CaseTransition,
    Customer,
    Invoice,
    NoticeType,
    OutboundCommunication,
    PaymentEvent,
    PaymentReconciliation,
    PromiseToPay,
    RecoveryCase,
    StatutoryNotice,
    Tenant,
    WorkflowActionRecord,
)
from app.services.audit import write_audit
from app.services.ingestion import ingest_payment_event
from app.services.statutory import (
    calculate_43b_h_statutory_due_date,
    calculate_msme_statutory_interest,
)
from app.services.workflow import transition_case


SYNTHETIC_SOURCE = "synthetic_seed"

MOCK_COMPANIES = [
    {
        "name": "Apex Precision Tooling Pvt Ltd (Synthetic)",
        "pan": "SYNAP1001A",
        "gstin": "99SYNAP1001A1Z5",
        "is_msme": True,
        "msme_cat": "Small",
        "contact_channel": "whatsapp",
        "contact_val": "+919811000101",
    },
    {
        "name": "Kaveri Logistics & Haulage Ltd (Synthetic)",
        "pan": "SYNKV2002B",
        "gstin": "99SYNKV2002B1Z4",
        "is_msme": True,
        "msme_cat": "Medium",
        "contact_channel": "whatsapp",
        "contact_val": "+919811000102",
    },
    {
        "name": "Deccan Electronics Assemblers (Synthetic)",
        "pan": "SYNDE3003C",
        "gstin": "99SYNDE3003C1Z3",
        "is_msme": True,
        "msme_cat": "Micro",
        "contact_channel": "phone",
        "contact_val": "+919811000103",
    },
    {
        "name": "Narmada Agro Chem Distributors (Synthetic)",
        "pan": "SYNNA4004D",
        "gstin": "99SYNNA4004D1Z2",
        "is_msme": False,
        "msme_cat": None,
        "contact_channel": "email",
        "contact_val": "ap@narmada-synthetic-corp.in",
    },
    {
        "name": "Shree Balaji Forge & Castings (Synthetic)",
        "pan": "SYNSB5005E",
        "gstin": "99SYNSB5005E1Z1",
        "is_msme": True,
        "msme_cat": "Small",
        "contact_channel": "whatsapp",
        "contact_val": "+919811000105",
    },
    {
        "name": "Vanguard Retail Supermarkets Ltd (Synthetic)",
        "pan": "SYNVR6006F",
        "gstin": "99SYNVR6006F1Z9",
        "is_msme": False,
        "msme_cat": None,
        "contact_channel": "whatsapp",
        "contact_val": "+919811000106",
    },
]

MOCK_SCENARIOS = {
    "mixed": [
        {
            "comp_idx": 0,
            "amount_minor": 18500000,  # ₹1,85,000
            "days_overdue": 12,
            "failure_code": "INSUFFICIENT_FUNDS",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "insufficient_funds",
            "rzp_desc": "The customer's bank account has insufficient balance for auto-debit.",
            "target_state": "promise_recorded",
            "hinglish_promise": "Bhai abhi cash thoda tight hai, Friday shaam 4 baje 1.85L RTGS pakka kar dunga.",
            "promise_days_ahead": 4,
        },
        {
            "comp_idx": 1,
            "amount_minor": 47500000,  # ₹4,75,000
            "days_overdue": 38,
            "failure_code": "BANK_DECLINE",
            "rzp_code": "GATEWAY_ERROR",
            "rzp_reason": "bank_server_down",
            "rzp_desc": "Destination bank core banking switch timed out during authorization handshake.",
            "target_state": "awaiting_action",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 2,
            "amount_minor": 9400000,  # ₹94,000
            "days_overdue": 46,  # >45d MSME trigger
            "failure_code": "MANDATE_FAILED",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "mandate_frequency_limit_exceeded",
            "rzp_desc": "Debit execution exceeded registered mandate frequency schedule.",
            "target_state": "human_review",
            "hinglish_promise": "Invoice amount mein TDS 2% deduct hona chahiye tha, statement rectify karo.",
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 4,
            "amount_minor": 23000000,  # ₹2,30,000
            "days_overdue": 18,
            "failure_code": "GATEWAY_TIMEOUT",
            "rzp_code": "GATEWAY_ERROR",
            "rzp_reason": "gateway_timeout",
            "rzp_desc": "Payment gateway timed out waiting for NPCI UPI collect response.",
            "target_state": "recovered",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 3,
            "amount_minor": 62000000,  # ₹6,20,000
            "days_overdue": 5,
            "failure_code": "CARD_DECLINE",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "velocity_limit_exceeded",
            "rzp_desc": "Card transaction velocity exceeded limits for debtor account.",
            "target_state": "awaiting_response",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 0,
            "amount_minor": 7800000,  # ₹78,000
            "days_overdue": 42,
            "failure_code": "INSUFFICIENT_FUNDS",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "insufficient_funds",
            "rzp_desc": "Insufficient balance on auto-debit attempt.",
            "target_state": "promise_recorded",
            "hinglish_promise": "Sir kal morning 11 baje tak ₹78,000 transfer ho jayega NEFT se.",
            "promise_days_ahead": 2,
        },
    ],
    "msme_43b_h": [
        {
            "comp_idx": 0,
            "amount_minor": 32000000,  # ₹3,20,000
            "days_overdue": 43,  # Critical 2 days remaining
            "failure_code": "INSUFFICIENT_FUNDS",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "insufficient_funds",
            "rzp_desc": "Debit declined due to insufficient balance in buyer operational account.",
            "target_state": "awaiting_action",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 2,
            "amount_minor": 18500000,  # ₹1,85,000
            "days_overdue": 47,  # Already breached 45 days
            "failure_code": "BANK_DECLINE",
            "rzp_code": "GATEWAY_ERROR",
            "rzp_reason": "bank_server_down",
            "rzp_desc": "Core banking failure during recurring RTGS run.",
            "target_state": "human_review",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 4,
            "amount_minor": 55000000,  # ₹5,50,000
            "days_overdue": 41,  # 4 days remaining
            "failure_code": "MANDATE_FAILED",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "mandate_frequency_limit_exceeded",
            "rzp_desc": "Mandate limit breach.",
            "target_state": "promise_recorded",
            "hinglish_promise": "Haanji 43B(h) notice receive hua. Monday tak 5.5L clear kar rahe hain.",
            "promise_days_ahead": 3,
        },
    ],
    "payment_failures": [
        {
            "comp_idx": 1,
            "amount_minor": 85000000,  # ₹8,50,000
            "days_overdue": 8,
            "failure_code": "BANK_DECLINE",
            "rzp_code": "GATEWAY_ERROR",
            "rzp_reason": "bank_server_down",
            "rzp_desc": "HDFC netbanking switch timeout during authorization.",
            "target_state": "awaiting_action",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
        {
            "comp_idx": 3,
            "amount_minor": 14000000,  # ₹1,40,000
            "days_overdue": 14,
            "failure_code": "MANDATE_FAILED",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "mandate_frequency_limit_exceeded",
            "rzp_desc": "Multiple debit submissions exceeded registered schedule.",
            "target_state": "awaiting_action",
            "hinglish_promise": None,
            "promise_days_ahead": None,
        },
    ],
    "hinglish_promissory": [
        {
            "comp_idx": 0,
            "amount_minor": 18500000,
            "days_overdue": 10,
            "failure_code": "INSUFFICIENT_FUNDS",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "insufficient_funds",
            "rzp_desc": "Auto debit failure.",
            "target_state": "promise_recorded",
            "hinglish_promise": "Bhai kal sham tak pakka 1.85L account mein dal denge.",
            "promise_days_ahead": 1,
        },
        {
            "comp_idx": 4,
            "amount_minor": 27000000,
            "days_overdue": 16,
            "failure_code": "INSUFFICIENT_FUNDS",
            "rzp_code": "BAD_REQUEST_ERROR",
            "rzp_reason": "insufficient_funds",
            "rzp_desc": "Auto debit failure.",
            "target_state": "promise_recorded",
            "hinglish_promise": "Next Tuesday morning tak 2.7L RTGS kar rahe hain, tension mat lo.",
            "promise_days_ahead": 4,
        },
    ],
}


def generate_tenant_sample_data(
    db: Session,
    *,
    tenant: Tenant,
    actor_uid: str,
    scenario: str = "mixed",
    count: int = 6,
) -> dict:
    """
    Idempotently creates realistic, tenant-scoped synthetic recovery data.
    All records are strictly tagged with SYNTHETIC_SOURCE and isolated to tenant.id.
    """
    now = datetime.now(UTC)
    clean_scenario = scenario if scenario in MOCK_SCENARIOS else "mixed"
    template_items = MOCK_SCENARIOS[clean_scenario]

    # Repeat or slice templates to match requested count
    target_templates = []
    while len(target_templates) < count:
        target_templates.extend(template_items)
    target_templates = target_templates[:count]

    created_customers: list[Customer] = []
    # 1. Create or get synthetic customers for this tenant
    for idx, c_def in enumerate(MOCK_COMPANIES):
        ext_ref = f"CUST-SYN-{tenant.id[:8]}-{idx + 1:03d}"
        cust = db.scalar(
            select(Customer).where(
                Customer.tenant_id == tenant.id,
                Customer.external_ref == ext_ref,
            )
        )
        if not cust:
            cust = Customer(
                tenant_id=tenant.id,
                external_ref=ext_ref,
                display_name=c_def["name"],
                contact_channel=c_def["contact_channel"],
                contact_value=c_def["contact_val"],
                gstin=c_def["gstin"],
                pan=c_def["pan"],
                is_msme=c_def["is_msme"],
                msme_category=c_def["msme_cat"],
                udyam_reg_number=f"UDYAM-SYN-{idx + 1:04d}" if c_def["is_msme"] else None,
                phone_number=c_def["contact_val"] if c_def["contact_channel"] in ("whatsapp", "phone") else None,
            )
            db.add(cust)
            db.flush()
        created_customers.append(cust)

    cases_created = []
    # 2. Generate each invoice, payment failure, recovery case, and connected artifact
    for i, item in enumerate(target_templates):
        cust = created_customers[item["comp_idx"] % len(created_customers)]
        inv_number = f"INV-SYN-{tenant.id[:8]}-{i + 1:04d}"

        # Check if invoice already exists
        existing_inv = db.scalar(
            select(Invoice).where(
                Invoice.tenant_id == tenant.id,
                Invoice.invoice_number == inv_number,
            )
        )
        if existing_inv:
            continue

        issued_at = now - timedelta(days=item["days_overdue"] + 30)
        due_at = now - timedelta(days=item["days_overdue"])
        statutory_due = calculate_43b_h_statutory_due_date(
            issued_at,
            agreement_exists=True,
        )

        inv = Invoice(
            tenant_id=tenant.id,
            customer_id=cust.id,
            invoice_number=inv_number,
            amount_minor=item["amount_minor"],
            currency="INR",
            issued_at=issued_at,
            due_at=due_at,
            status="overdue",
            tds_rate_percent=2.0 if cust.is_msme else 0.0,
            tds_minor=int(item["amount_minor"] * 0.02) if cust.is_msme else 0,
            net_payable_minor=int(item["amount_minor"] * 0.98) if cust.is_msme else item["amount_minor"],
            statutory_due_date=statutory_due,
        )
        db.add(inv)
        db.flush()

        # 3. Ingest synthetic payment event with realistic Razorpay taxonomy payload
        provider_event_id = f"evt_syn_{tenant.id[:8]}_{inv.invoice_number}_{int(now.timestamp())}"
        raw_payload = {
            "entity": "event",
            "account_id": f"acc_syn_{tenant.id[:8]}",
            "event": "payment.failed",
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_syn_{i + 1:04d}",
                        "amount": item["amount_minor"],
                        "currency": "INR",
                        "status": "failed",
                        "method": "upi",
                        "description": f"Settlement for {inv.invoice_number}",
                        "notes": {
                            "invoice_number": inv.invoice_number,
                            "tenant_id": tenant.id,
                            "synthetic_marker": SYNTHETIC_SOURCE,
                        },
                        "error_code": item["rzp_code"],
                        "error_description": item["rzp_desc"],
                        "error_source": "gateway",
                        "error_step": "payment_authorization",
                        "error_reason": item["rzp_reason"],
                    }
                }
            },
            "created_at": int(now.timestamp()),
        }

        pevent, case, _ = ingest_payment_event(
            db,
            tenant=tenant,
            source=SYNTHETIC_SOURCE,
            provider_event_id=provider_event_id,
            invoice=inv,
            event_type="payment.failed",
            payload=raw_payload,
            occurred_at=due_at + timedelta(days=1),
            failure_code=item["failure_code"],
            note=item["rzp_desc"],
            correlation_id=f"corr_syn_{inv.invoice_number}",
        )

        if not case:
            continue

        # 4. Scenario-specific state morphing
        target_state = item.get("target_state", "awaiting_action")

        # Hinglish promise handling
        if item.get("hinglish_promise"):
            p_date = now + timedelta(days=item.get("promise_days_ahead") or 3)
            p2p = PromiseToPay(
                tenant_id=tenant.id,
                case_id=case.id,
                amount_minor=item["amount_minor"],
                promised_date=p_date,
                confidence=0.94,
                raw_text=item["hinglish_promise"],
                language_mix="hinglish",
                status="recorded",
            )
            db.add(p2p)
            db.flush()

            # Follow allowed workflow path: awaiting_action -> contacted -> awaiting_response -> promise_recorded
            if case.state == CaseState.AWAITING_ACTION.value:
                transition_case(
                    db,
                    case,
                    to_state=CaseState.CONTACTED.value,
                    reason="Automated WhatsApp check-in sent to debtor.",
                    actor_type=ActorType.SYSTEM.value,
                    correlation_id=f"corr_out_{case.id[:8]}",
                )
            if case.state == CaseState.CONTACTED.value:
                transition_case(
                    db,
                    case,
                    to_state=CaseState.AWAITING_RESPONSE.value,
                    reason="Awaiting customer commitment.",
                    actor_type=ActorType.SYSTEM.value,
                    correlation_id=f"corr_wait_{case.id[:8]}",
                )
            if case.state == CaseState.AWAITING_RESPONSE.value:
                transition_case(
                    db,
                    case,
                    to_state=CaseState.PROMISE_RECORDED.value,
                    reason="Hinglish promise extracted and verified with debtor.",
                    actor_type=ActorType.SYSTEM.value,
                    correlation_id=f"corr_p2p_{case.id[:8]}",
                )

        elif target_state == "recovered":
            # Record reconciliation
            recon = PaymentReconciliation(
                tenant_id=tenant.id,
                case_id=case.id,
                reconciliation_type="bank_utr",
                amount_minor=inv.amount_minor,
                reference_number=f"UTR{int(now.timestamp())}{random.randint(100, 999)}",
                proof_payload_json=json.dumps({"method": "rtgs", "note": "Synthetically settled via direct corporate RTGS voucher"}),
                reconciled_by=actor_uid,
            )
            db.add(recon)
            inv.status = "paid"
            transition_case(
                db,
                case,
                to_state=CaseState.RECOVERED.value,
                reason="Direct bank RTGS verified and reconciled.",
                actor_type=ActorType.USER.value,
                correlation_id=f"corr_rec_{case.id[:8]}",
            )

        elif target_state == "human_review":
            transition_case(
                db,
                case,
                to_state=CaseState.HUMAN_REVIEW.value,
                reason="Commercial discrepancy requires manual operator intervention.",
                actor_type=ActorType.SYSTEM.value,
                correlation_id=f"corr_rev_{case.id[:8]}",
            )

        # Statutory MSME interest accrual
        if cust.is_msme and item["days_overdue"] > 0:
            interest_minor, _ = calculate_msme_statutory_interest(
                inv.amount_minor,
                issued_at=inv.issued_at,
                now=now,
            )
            case.statutory_interest_minor = interest_minor

        cases_created.append(case.id)

    write_audit(
        db,
        action="tenant.sample_data_generated",
        resource_type="tenant",
        resource_id=tenant.id,
        tenant_id=tenant.id,
        actor_type="user",
        actor_uid=actor_uid,
        payload={
            "scenario": clean_scenario,
            "count_requested": count,
            "cases_created": len(cases_created),
            "source": SYNTHETIC_SOURCE,
        },
    )
    db.commit()

    return {
        "status": "success",
        "scenario": clean_scenario,
        "cases_created": len(cases_created),
        "case_ids": cases_created,
        "tenant_id": tenant.id,
        "source": SYNTHETIC_SOURCE,
    }


def clear_tenant_sample_data(
    db: Session,
    *,
    tenant: Tenant,
    actor_uid: str,
) -> dict:
    """
    Safely purges only synthetic records for the authenticated tenant.
    Never removes non-synthetic production data.
    """
    # 1. Find all synthetic invoices
    synthetic_invoices = db.scalars(
        select(Invoice.id).where(
            Invoice.tenant_id == tenant.id,
            Invoice.invoice_number.like("INV-SYN-%"),
        )
    ).all()

    inv_ids = list(synthetic_invoices)

    if inv_ids:
        # Find related cases
        case_ids = list(
            db.scalars(
                select(RecoveryCase.id).where(
                    RecoveryCase.tenant_id == tenant.id,
                    RecoveryCase.invoice_id.in_(inv_ids),
                )
            ).all()
        )

        if case_ids:
            # Delete dependent relations
            db.execute(delete(PromiseToPay).where(PromiseToPay.case_id.in_(case_ids)))
            db.execute(delete(CaseTransition).where(CaseTransition.case_id.in_(case_ids)))
            db.execute(delete(WorkflowActionRecord).where(WorkflowActionRecord.case_id.in_(case_ids)))
            db.execute(delete(StatutoryNotice).where(StatutoryNotice.case_id.in_(case_ids)))
            db.execute(delete(OutboundCommunication).where(OutboundCommunication.case_id.in_(case_ids)))
            db.execute(delete(PaymentReconciliation).where(PaymentReconciliation.case_id.in_(case_ids)))
            db.execute(delete(RecoveryCase).where(RecoveryCase.id.in_(case_ids)))

        # Delete synthetic payment events
        db.execute(
            delete(PaymentEvent).where(
                PaymentEvent.tenant_id == tenant.id,
                PaymentEvent.source == SYNTHETIC_SOURCE,
            )
        )

        # Delete invoices
        db.execute(delete(Invoice).where(Invoice.id.in_(inv_ids)))

    # Delete synthetic customers with no remaining invoices
    synthetic_custs = db.scalars(
        select(Customer.id).where(
            Customer.tenant_id == tenant.id,
            Customer.external_ref.like("CUST-SYN-%"),
        )
    ).all()
    for c_id in synthetic_custs:
        has_inv = db.scalar(select(Invoice.id).where(Invoice.customer_id == c_id))
        if not has_inv:
            db.execute(delete(Customer).where(Customer.id == c_id))

    write_audit(
        db,
        action="tenant.sample_data_cleared",
        resource_type="tenant",
        resource_id=tenant.id,
        tenant_id=tenant.id,
        actor_type="user",
        actor_uid=actor_uid,
        payload={"cleared_invoice_count": len(inv_ids)},
    )
    db.commit()

    return {
        "status": "cleared",
        "invoices_removed": len(inv_ids),
        "tenant_id": tenant.id,
    }
