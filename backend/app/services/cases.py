from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import Conflict, DependencyFailed, NotFound, ValidationFailed
from app.db.models import (
    ActorType,
    CaseState,
    Customer,
    DisputeStatus,
    Invoice,
    NoticeType,
    OutboundCommunication,
    PaymentReconciliation,
    PromiseToPay,
    RecoveryCase,
    RiskTier,
    StatutoryNotice,
    Tenant,
)
from app.llm.client import LLMClient
from app.services.audit import write_audit
from app.services.channels import compose_whatsapp_interactive_payload, generate_dynamic_upi_payload
from app.services.compliance import evaluate_compliance
from app.services.extraction import EXTRACTION_SYSTEM_PROMPT, customer_prompt, validate_promise
from app.services.statutory import (
    calculate_msme_statutory_interest,
    generate_statutory_notice_draft,
    get_43b_h_status,
)
from app.services.workflow import record_action, transition_case


def get_tenant_case(db: Session, *, tenant_id: str, case_id: str) -> RecoveryCase:
    case = db.get(RecoveryCase, case_id)
    if case is None or case.tenant_id != tenant_id:
        raise NotFound("Case not found.")
    return case


def compose_reminder(*, tenant: Tenant, invoice: Invoice) -> str:
    rupees = invoice.amount_minor / 100
    return (
        f"{tenant.legal_name} is writing about overdue invoice {invoice.invoice_number} "
        f"for INR {rupees:.2f}. Please confirm when payment will be made. "
        "This message is intended only for the authorised billing contact."
    )


def issue_statutory_notice(
    db: Session,
    *,
    case: RecoveryCase,
    tenant: Tenant,
    notice_type: NoticeType | str,
    actor_id: str,
    correlation_id: str | None,
) -> StatutoryNotice:
    invoice = db.get(Invoice, case.invoice_id)
    customer = db.get(Customer, case.customer_id)
    if not invoice or not customer:
        raise NotFound("Invoice or customer record not found.")

    draft = generate_statutory_notice_draft(
        notice_type,
        tenant=tenant,
        customer=customer,
        invoice=invoice,
        now=datetime.now(UTC),
    )

    notice = StatutoryNotice(
        tenant_id=tenant.id,
        case_id=case.id,
        notice_type=str(notice_type),
        title=draft["title"],
        recipient_name=draft["recipient_name"],
        recipient_contact=draft["recipient_contact"],
        content_markdown=draft["content_markdown"],
        statutory_reference=draft["statutory_reference"],
        claim_amount_minor=draft["claim_amount_minor"],
        statutory_interest_minor=draft["statutory_interest_minor"],
        cure_period_days=draft["cure_period_days"],
        status="generated",
    )
    db.add(notice)
    
    # Update accrued interest on case
    case.statutory_interest_minor = draft["statutory_interest_minor"]

    record_action(
        db,
        case,
        action_type=f"generate_notice_{notice_type}",
        status="executed",
        reason=f"Generated statutory {notice_type} notice under {draft['statutory_reference']}",
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )

    write_audit(
        db,
        action="case.statutory_notice_generated",
        resource_type="statutory_notice",
        resource_id=notice.id,
        tenant_id=tenant.id,
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={
            "notice_type": str(notice_type),
            "claim_minor": notice.claim_amount_minor,
            "interest_minor": notice.statutory_interest_minor,
        },
    )
    db.flush()
    return notice


def reconcile_tds(
    db: Session,
    *,
    case: RecoveryCase,
    tds_rate_percent: float,
    form_16a_ack: str,
    actor_id: str,
    correlation_id: str | None,
) -> dict:
    invoice = db.get(Invoice, case.invoice_id)
    if not invoice:
        raise NotFound("Invoice not found.")

    tds_minor = int(round(invoice.amount_minor * (tds_rate_percent / 100.0)))
    net_payable = max(invoice.amount_minor - tds_minor, 0)

    invoice.tds_rate_percent = tds_rate_percent
    invoice.tds_minor = tds_minor
    invoice.net_payable_minor = net_payable
    invoice.dispute_status = DisputeStatus.TDS_DEDUCTED.value

    recon = PaymentReconciliation(
        tenant_id=case.tenant_id,
        case_id=case.id,
        reconciliation_type="tds_form_16a",
        amount_minor=tds_minor,
        reference_number=form_16a_ack,
        proof_payload_json=f'{{"tds_rate": {tds_rate_percent}, "net_payable": {net_payable}}}',
        reconciled_by=actor_id,
    )
    db.add(recon)

    record_action(
        db,
        case,
        action_type="reconcile_tds",
        status="executed",
        reason=f"Reconciled TDS of {tds_rate_percent}% (INR {tds_minor/100:.2f}) against Form 16A ack {form_16a_ack}.",
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )

    write_audit(
        db,
        action="case.tds_reconciled",
        resource_type="recovery_case",
        resource_id=case.id,
        tenant_id=case.tenant_id,
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        payload={"tds_minor": tds_minor, "form_16a_ack": form_16a_ack},
    )
    db.flush()
    return {
        "status": "reconciled",
        "tds_minor": tds_minor,
        "net_payable_minor": net_payable,
    }


def record_payment_reconciliation(
    db: Session,
    *,
    case: RecoveryCase,
    amount_minor: int,
    reconciliation_type: str,
    reference_number: str,
    actor_id: str,
    correlation_id: str | None,
) -> dict:
    invoice = db.get(Invoice, case.invoice_id)
    if not invoice:
        raise NotFound("Invoice not found.")

    recon = PaymentReconciliation(
        tenant_id=case.tenant_id,
        case_id=case.id,
        reconciliation_type=reconciliation_type,
        amount_minor=amount_minor,
        reference_number=reference_number,
        proof_payload_json="{}",
        reconciled_by=actor_id,
    )
    db.add(recon)

    current_balance = invoice.net_payable_minor if invoice.net_payable_minor > 0 else invoice.amount_minor
    new_balance = max(current_balance - amount_minor, 0)
    invoice.net_payable_minor = new_balance

    fully_paid = new_balance == 0

    record_action(
        db,
        case,
        action_type=f"payment_{reconciliation_type}",
        status="executed",
        reason=f"Recorded payment of INR {amount_minor/100:.2f} via {reconciliation_type} (Ref: {reference_number}).",
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )

    if fully_paid and case.state not in {CaseState.RECOVERED.value, CaseState.CANCELLED.value}:
        invoice.status = "paid"
        transition_case(
            db,
            case,
            to_state=CaseState.RECOVERED.value,
            reason=f"Full remittance reconciled via {reconciliation_type} (Ref: {reference_number}).",
            actor_type=ActorType.USER.value,
            actor_id=actor_id,
            correlation_id=correlation_id,
        )

    write_audit(
        db,
        action="case.payment_reconciled",
        resource_type="recovery_case",
        resource_id=case.id,
        tenant_id=case.tenant_id,
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        payload={"amount_minor": amount_minor, "reference_number": reference_number, "fully_paid": fully_paid},
    )
    db.flush()
    return {
        "status": "payment_recorded",
        "amount_minor": amount_minor,
        "remaining_balance_minor": new_balance,
        "fully_paid": fully_paid,
    }


def apply_cash_discount(
    db: Session,
    *,
    case: RecoveryCase,
    discount_percent: float,
    actor_id: str,
    correlation_id: str | None,
) -> dict:
    if not (0.0 <= discount_percent <= 15.0):
        raise ValidationFailed("Cash discount must be between 0% and 15%.")
    case.cash_discount_offered_percent = discount_percent
    record_action(
        db,
        case,
        action_type="offer_cash_discount",
        status="executed",
        reason=f"Approved dynamic early settlement discount of {discount_percent:.1f}%.",
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )
    db.flush()
    return {"status": "discount_applied", "discount_percent": discount_percent}


def request_outbound_contact(
    db: Session,
    *,
    case: RecoveryCase,
    tenant: Tenant,
    actor_id: str,
    correlation_id: str | None,
    settings: Settings,
    expected_version: int | None,
    idempotency_key: str | None,
    now: datetime | None = None,
) -> dict:
    if case.state not in {CaseState.AWAITING_ACTION.value, CaseState.AWAITING_RESPONSE.value}:
        raise Conflict("Case is not in a state that allows outbound contact.")
    invoice = db.get(Invoice, case.invoice_id)
    if invoice is None:
        raise NotFound("Invoice not found.")
    message = compose_reminder(tenant=tenant, invoice=invoice)
    decision = evaluate_compliance(
        db,
        tenant_id=tenant.id,
        case_id=case.id,
        action_type="send_reminder",
        message=message,
        merchant_legal_name=tenant.legal_name,
        settings=settings,
        now=now,
    )
    if not decision.allowed:
        record_action(
            db,
            case,
            action_type="send_reminder",
            status="blocked",
            reason="; ".join(decision.failed_rule_ids),
            actor_type=ActorType.USER.value,
            actor_id=actor_id,
            correlation_id=correlation_id,
            idempotency_key=idempotency_key,
        )
        if case.state != CaseState.BLOCKED.value:
            transition_case(
                db,
                case,
                to_state=CaseState.BLOCKED.value,
                reason="Compliance blocked outbound contact.",
                actor_type=ActorType.USER.value,
                actor_id=actor_id,
                correlation_id=correlation_id,
                expected_version=expected_version,
            )
        db.add(
            OutboundCommunication(
                tenant_id=tenant.id,
                case_id=case.id,
                channel="email",
                body=message,
                blocked=True,
            )
        )
        write_audit(
            db,
            action="case.contact_blocked",
            resource_type="recovery_case",
            resource_id=case.id,
            tenant_id=tenant.id,
            actor_type=ActorType.USER.value,
            actor_id=actor_id,
            correlation_id=correlation_id,
            payload={"failed_rule_ids": decision.failed_rule_ids},
        )
        return {
            "status": "blocked",
            "failed_rule_ids": decision.failed_rule_ids,
            "results": [item.__dict__ for item in decision.results],
        }

    db.add(
        OutboundCommunication(
            tenant_id=tenant.id,
            case_id=case.id,
            channel="email",
            body=message,
            blocked=False,
        )
    )
    case.contact_attempt_count += 1
    action = record_action(
        db,
        case,
        action_type="send_reminder",
        status="executed",
        reason="Compliant reminder queued for the authorised billing contact.",
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
        idempotency_key=idempotency_key,
    )
    if case.state == CaseState.AWAITING_ACTION.value:
        transition_case(
            db,
            case,
            to_state=CaseState.CONTACTED.value,
            reason="Reminder sent after compliance clearance.",
            actor_type=ActorType.USER.value,
            actor_id=actor_id,
            correlation_id=correlation_id,
            action_id=action.id,
            expected_version=expected_version,
        )
        transition_case(
            db,
            case,
            to_state=CaseState.AWAITING_RESPONSE.value,
            reason="Awaiting customer reply.",
            actor_type=ActorType.SYSTEM.value,
            correlation_id=correlation_id,
            action_id=action.id,
        )
    write_audit(
        db,
        action="case.contact_sent",
        resource_type="recovery_case",
        resource_id=case.id,
        tenant_id=tenant.id,
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )
    return {
        "status": "executed",
        "failed_rule_ids": [],
        "results": [item.__dict__ for item in decision.results],
    }


def ingest_customer_reply(
    db: Session,
    *,
    case: RecoveryCase,
    message: str,
    actor_id: str,
    correlation_id: str | None,
    llm: LLMClient,
    expected_version: int | None,
) -> dict:
    if case.state not in {CaseState.AWAITING_RESPONSE.value, CaseState.CONTACTED.value}:
        raise Conflict("Case is not awaiting a customer reply.")
    invoice = db.get(Invoice, case.invoice_id)
    if invoice is None:
        raise NotFound("Invoice not found.")
    try:
        payload = llm.extract_json(
            system_prompt=EXTRACTION_SYSTEM_PROMPT,
            user_prompt=customer_prompt(message, as_of=datetime.now(UTC)),
        )
    except DependencyFailed:
        transition_case(
            db,
            case,
            to_state=CaseState.HUMAN_REVIEW.value,
            reason="LLM unavailable; promise extraction requires human review.",
            actor_type=ActorType.SYSTEM.value,
            actor_id=actor_id,
            correlation_id=correlation_id,
            expected_version=expected_version,
        )
        return {"status": "human_review", "reason": "llm_unavailable"}

    extracted, failure = validate_promise(
        payload,
        invoice_amount_minor=invoice.amount_minor,
        today=datetime.now(UTC).date(),
    )
    promise = PromiseToPay(
        tenant_id=case.tenant_id,
        case_id=case.id,
        amount_minor=extracted.amount if extracted and extracted.amount is not None else 0,
        promised_date=datetime.combine(extracted.promised_date, datetime.min.time(), tzinfo=UTC)
        if extracted and extracted.promised_date
        else datetime.now(UTC),
        confidence=extracted.confidence if extracted and extracted.confidence is not None else 0,
        raw_text=message,
        language_mix=extracted.language_mix if extracted and extracted.language_mix else "unknown",
        status="recorded" if failure is None else "needs_review",
        extraction_failure=failure,
    )
    db.add(promise)
    if failure:
        transition_case(
            db,
            case,
            to_state=CaseState.HUMAN_REVIEW.value,
            reason=f"Promise extraction failed validation: {failure}.",
            actor_type=ActorType.LLM.value,
            correlation_id=correlation_id,
            expected_version=expected_version,
        )
        return {"status": "human_review", "reason": failure}

    transition_case(
        db,
        case,
        to_state=CaseState.PROMISE_RECORDED.value,
        reason="Validated promise-to-pay recorded.",
        actor_type=ActorType.LLM.value,
        correlation_id=correlation_id,
        expected_version=expected_version,
    )
    write_audit(
        db,
        action="case.promise_recorded",
        resource_type="recovery_case",
        resource_id=case.id,
        tenant_id=case.tenant_id,
        actor_type=ActorType.LLM.value,
        correlation_id=correlation_id,
        payload={"amount_minor": promise.amount_minor, "confidence": float(promise.confidence)},
    )
    return {"status": "recorded", "reason": None}


def apply_human_override(
    db: Session,
    *,
    case: RecoveryCase,
    action: str,
    reason: str,
    actor_id: str,
    correlation_id: str | None,
    expected_version: int | None,
) -> RecoveryCase:
    if not reason.strip():
        raise ValidationFailed("Override reason is required.")
    mapping = {
        "pause": CaseState.PAUSED.value,
        "resume": CaseState.AWAITING_ACTION.value,
        "escalate": CaseState.HUMAN_REVIEW.value,
        "mark_recovered": CaseState.RECOVERED.value,
        "mark_unrecoverable": CaseState.UNRECOVERABLE.value,
        "cancel": CaseState.CANCELLED.value,
    }
    to_state = mapping.get(action)
    if to_state is None:
        raise ValidationFailed("Unknown override action.")
    transition_case(
        db,
        case,
        to_state=to_state,
        reason=reason.strip(),
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
        expected_version=expected_version,
    )
    record_action(
        db,
        case,
        action_type=f"override_{action}",
        status="executed",
        reason=reason.strip(),
        actor_type=ActorType.USER.value,
        actor_id=actor_id,
        correlation_id=correlation_id,
    )
    return case
