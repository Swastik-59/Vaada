from __future__ import annotations

from datetime import UTC, date, datetime
import json
import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.schemas import (
    CustomerPortalDisputeRequest,
    CustomerPortalPaymentRequest,
    CustomerPortalPromiseRequest,
)
from app.authz.deps import get_db
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.db.models import (
    ActorType,
    CaseState,
    Customer,
    DisputeStatus,
    Invoice,
    PromiseToPay,
    RecoveryCase,
    Tenant,
)
from app.services.audit import write_audit
from app.services.cases import record_payment_reconciliation
from app.services.portal import verify_portal_token
from app.services.statutory import get_43b_h_status
from app.services.workflow import transition_case

portal_router = APIRouter(prefix="/portal", tags=["Customer Portal"])


@portal_router.get("/{token}")
def get_portal_dossier(token: str, db: Session = Depends(get_db)) -> dict:
    claims = verify_portal_token(token)
    case_id = claims["case_id"]
    invoice_id = claims["invoice_id"]
    tenant_id = claims["tenant_id"]

    tenant = db.get(Tenant, tenant_id)
    invoice = db.get(Invoice, invoice_id)
    case = db.get(RecoveryCase, case_id)

    if not tenant or not invoice or not case:
        raise NotFound("Receivable or invoice record could not be found.")

    customer = db.get(Customer, invoice.customer_id)

    # Statutory calculation
    statutory_info = get_43b_h_status(invoice, customer) if (invoice and customer) else None

    # Active promises
    promises = db.scalars(
        select(PromiseToPay)
        .where(PromiseToPay.case_id == case.id)
        .order_by(PromiseToPay.created_at.desc())
    ).all()

    active_promise = None
    if promises:
        p = promises[0]
        active_promise = {
            "id": p.id,
            "promised_date": p.promised_date.isoformat() if p.promised_date else None,
            "amount_minor": p.amount_minor,
            "confidence": p.confidence,
            "language_mix": p.language_mix,
            "created_at": p.created_at.isoformat(),
        }

    return {
        "invoice": {
            "id": invoice.id,
            "invoice_number": invoice.invoice_number,
            "currency": invoice.currency,
            "amount_minor": invoice.amount_minor,
            "tds_minor": invoice.tds_minor,
            "net_payable_minor": invoice.net_payable_minor,
            "status": invoice.status,
            "dispute_status": invoice.dispute_status,
            "dispute_notes": invoice.dispute_notes,
            "issued_at": invoice.issued_at.isoformat() if invoice.issued_at else None,
            "due_at": invoice.due_at.isoformat() if invoice.due_at else None,
        },
        "supplier": {
            "name": tenant.name,
            "legal_name": tenant.legal_name,
            "slug": tenant.slug,
        },
        "customer": {
            "display_name": customer.display_name if customer else "Authorized Commercial Buyer",
            "gstin": customer.gstin if customer else None,
            "is_msme": bool(customer and customer.is_msme),
        },
        "case": {
            "id": case.id,
            "state": case.state,
            "root_cause": case.root_cause,
        },
        "active_promise": active_promise,
        "statutory": statutory_info,
    }


@portal_router.post("/{token}/pay")
def customer_portal_pay(
    token: str,
    body: CustomerPortalPaymentRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    claims = verify_portal_token(token)
    case_id = claims["case_id"]
    invoice_id = claims["invoice_id"]
    tenant_id = claims["tenant_id"]

    case = db.get(RecoveryCase, case_id)
    invoice = db.get(Invoice, invoice_id)
    if not case or not invoice:
        raise NotFound("Invoice or recovery record not found.")

    if invoice.status == "paid" or case.state == CaseState.RECOVERED.value:
        return {
            "already_paid": True,
            "message": "This invoice has already been fully settled.",
            "invoice_number": invoice.invoice_number,
        }

    # Use database net_payable_minor - never trust client supplied amount
    amount_to_reconcile = invoice.net_payable_minor or invoice.amount_minor
    if body.amount_minor and 0 < body.amount_minor < amount_to_reconcile:
        amount_to_reconcile = body.amount_minor

    utr_reference = f"UTR{int(datetime.now(UTC).timestamp())}{uuid.uuid4().hex[:4].upper()}"

    record_payment_reconciliation(
        db,
        case=case,
        amount_minor=amount_to_reconcile,
        reconciliation_type=f"portal_{body.payment_method}",
        reference_number=utr_reference,
        actor_id=claims.get("customer_id", "portal_customer"),
        correlation_id=f"portal_pay_{int(datetime.now(UTC).timestamp())}",
    )

    write_audit(
        db,
        action="customer.portal.payment_success",
        resource_type="invoice",
        resource_id=invoice.id,
        tenant_id=tenant_id,
        actor_type=ActorType.DEBTOR.value,
        actor_id="customer_portal",
        payload={
            "amount_minor": amount_to_reconcile,
            "method": body.payment_method,
            "reference_number": utr_reference,
            "case_id": case.id,
        },
    )

    return {
        "success": True,
        "status": "payment_reconciled",
        "reference_number": utr_reference,
        "amount_minor": amount_to_reconcile,
        "invoice_number": invoice.invoice_number,
        "new_case_state": case.state,
        "paid_at": datetime.now(UTC).isoformat(),
    }


@portal_router.post("/{token}/promise")
def customer_portal_promise(
    token: str,
    body: CustomerPortalPromiseRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    claims = verify_portal_token(token)
    case_id = claims["case_id"]
    invoice_id = claims["invoice_id"]
    tenant_id = claims["tenant_id"]

    case = db.get(RecoveryCase, case_id)
    invoice = db.get(Invoice, invoice_id)
    if not case or not invoice:
        raise NotFound("Invoice or recovery record not found.")

    today = datetime.now(UTC).date()
    extracted_commitment = None
    extraction_failure = None

    if body.raw_message:
        from app.extraction.promise_extractor import PromiseExtractor
        extractor = PromiseExtractor()
        extracted_commitment, extraction_failure = extractor.extract(
            body.raw_message,
            invoice_amount_minor=invoice.net_payable_minor or invoice.amount_minor,
            today=today,
        )
        if extraction_failure == "adversarial_prompt_injection_blocked":
            write_audit(
                db,
                action="security.prompt_injection_blocked",
                resource_type="customer_portal",
                resource_id=case.id,
                tenant_id=tenant_id,
                actor_type=ActorType.DEBTOR.value,
                actor_id="customer_portal",
                payload={"raw_message": body.raw_message},
            )
            raise ValidationFailed("Adversarial prompt injection attempt detected and rejected.")

    promised_d = None
    if body.promised_date:
        try:
            promised_d = date.fromisoformat(body.promised_date)
        except ValueError as exc:
            raise ValidationFailed("Promised date must be in YYYY-MM-DD format.") from exc
    elif extracted_commitment and extracted_commitment.promised_date:
        promised_d = extracted_commitment.promised_date
    else:
        raise ValidationFailed("A valid commitment date or natural-language promise is required.")

    if promised_d < today:
        raise ValidationFailed("Promised date cannot be in the past.")

    amount_minor = body.amount_minor or (extracted_commitment.amount if extracted_commitment and extracted_commitment.amount else None) or invoice.net_payable_minor or invoice.amount_minor
    confidence = extracted_commitment.confidence if extracted_commitment else 0.95
    lang_mix = extracted_commitment.language_mix if extracted_commitment else "en"

    promised_dt = datetime.combine(promised_d, datetime.min.time(), tzinfo=UTC)

    promise = PromiseToPay(
        tenant_id=tenant_id,
        case_id=case.id,
        amount_minor=amount_minor,
        promised_date=promised_dt,
        confidence=confidence,
        raw_text=body.raw_message or f"Settlement committed for {promised_d.isoformat()}",
        language_mix=lang_mix,
    )
    db.add(promise)
    db.flush()

    # If case is in an active state, transition to PROMISE_RECORDED
    if case.state in {CaseState.AWAITING_RESPONSE.value, CaseState.CONTACTED.value, CaseState.AWAITING_ACTION.value, CaseState.BLOCKED.value}:
        try:
            transition_case(
                db,
                case,
                to_state=CaseState.PROMISE_RECORDED.value,
                reason="Debtor committed settlement date via Customer Portal.",
                actor_type=ActorType.DEBTOR.value,
                actor_id="customer_portal",
            )
        except Conflict:
            pass

    write_audit(
        db,
        action="customer.portal.promise_created",
        resource_type="promise",
        resource_id=promise.id,
        tenant_id=tenant_id,
        actor_type=ActorType.DEBTOR.value,
        actor_id="customer_portal",
        payload={
            "promised_date": promised_d.isoformat(),
            "amount_minor": amount_minor,
            "case_id": case.id,
            "language_mix": lang_mix,
            "confidence": confidence,
        },
    )

    return {
        "success": True,
        "status": "promise_recorded",
        "promise_id": promise.id,
        "promised_date": promised_d.isoformat(),
        "amount_minor": amount_minor,
        "case_state": case.state,
        "promise": {
            "promise_date": promised_d.isoformat(),
            "amount_minor": amount_minor,
            "confidence": confidence,
            "language_mix": lang_mix,
            "status": "valid",
        },
    }


@portal_router.post("/{token}/dispute")
def customer_portal_dispute(
    token: str,
    body: CustomerPortalDisputeRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    claims = verify_portal_token(token)
    case_id = claims["case_id"]
    invoice_id = claims["invoice_id"]
    tenant_id = claims["tenant_id"]

    case = db.get(RecoveryCase, case_id)
    invoice = db.get(Invoice, invoice_id)
    if not case or not invoice:
        raise NotFound("Invoice or recovery record not found.")

    status_mapping = {
        "tds_deducted": DisputeStatus.TDS_DEDUCTED.value,
        "gst_mismatch": DisputeStatus.GST_MISMATCH.value,
        "short_supply": DisputeStatus.SHORT_SUPPLY.value,
        "price_dispute": DisputeStatus.PRICE_DISPUTE.value,
    }
    invoice.dispute_status = status_mapping.get(body.dispute_type, DisputeStatus.PRICE_DISPUTE.value)
    invoice.dispute_notes = f"[{body.dispute_type.upper()}] {body.notes}"
    if body.tds_rate_percent is not None:
        invoice.dispute_notes += f" | Claimed TDS Rate: {body.tds_rate_percent}%"
    if body.acknowledgement_ref:
        invoice.dispute_notes += f" | Ack Ref: {body.acknowledgement_ref}"

    db.add(invoice)

    # Transition case to HUMAN_REVIEW for operator investigation
    if case.state in {
        CaseState.AWAITING_ACTION.value,
        CaseState.CONTACTED.value,
        CaseState.AWAITING_RESPONSE.value,
        CaseState.PROMISE_RECORDED.value,
    }:
        try:
            transition_case(
                db,
                case,
                to_state=CaseState.HUMAN_REVIEW.value,
                reason=f"Debtor submitted formal dispute via portal: {body.dispute_type}",
                actor_type=ActorType.DEBTOR.value,
                actor_id="customer_portal",
            )
        except Conflict:
            pass

    write_audit(
        db,
        action="customer.portal.dispute_raised",
        resource_type="invoice",
        resource_id=invoice.id,
        tenant_id=tenant_id,
        actor_type=ActorType.DEBTOR.value,
        actor_id="customer_portal",
        payload={
            "dispute_type": body.dispute_type,
            "notes": body.notes,
            "case_id": case.id,
        },
    )

    return {
        "success": True,
        "status": "dispute_recorded",
        "invoice_number": invoice.invoice_number,
        "dispute_status": invoice.dispute_status,
        "case_state": case.state,
        "message": "Your dispute has been logged with the commercial credit team. An operator will review your documentation.",
    }
