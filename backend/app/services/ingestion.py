from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    ActorType,
    CaseState,
    ClassificationMethod,
    Invoice,
    PaymentEvent,
    RecoveryCase,
    Tenant,
)
from app.services.audit import write_audit
from app.services.classification import classify_event
from app.services.scoring import score_recovery
from app.services.workflow import transition_case


def ingest_payment_event(
    db: Session,
    *,
    tenant: Tenant,
    source: str,
    provider_event_id: str,
    invoice: Invoice,
    event_type: str,
    payload: dict,
    occurred_at: datetime,
    failure_code: str | None,
    note: str | None,
    correlation_id: str | None,
) -> tuple[PaymentEvent, RecoveryCase | None, bool]:
    existing = db.scalar(
        select(PaymentEvent).where(
            PaymentEvent.source == source,
            PaymentEvent.provider_event_id == provider_event_id,
        )
    )
    if existing:
        write_audit(
            db,
            action="event.duplicate_ignored",
            resource_type="payment_event",
            resource_id=existing.id,
            tenant_id=tenant.id,
            correlation_id=correlation_id,
            payload={"provider_event_id": provider_event_id, "source": source},
        )
        case = db.scalar(select(RecoveryCase).where(RecoveryCase.source_event_id == existing.id))
        return existing, case, True

    event = PaymentEvent(
        tenant_id=tenant.id,
        source=source,
        provider_event_id=provider_event_id,
        invoice_id=invoice.id,
        customer_id=invoice.customer_id,
        event_type=event_type,
        payload_json=json.dumps(payload, default=str),
        occurred_at=occurred_at,
    )
    db.add(event)
    db.flush()
    write_audit(
        db,
        action="event.ingested",
        resource_type="payment_event",
        resource_id=event.id,
        tenant_id=tenant.id,
        correlation_id=correlation_id,
        payload={"provider_event_id": provider_event_id, "event_type": event_type},
    )

    existing_case = db.scalar(select(RecoveryCase).where(RecoveryCase.invoice_id == invoice.id))
    if existing_case:
        return event, existing_case, False

    case = RecoveryCase(
        tenant_id=tenant.id,
        invoice_id=invoice.id,
        customer_id=invoice.customer_id,
        source_event_id=event.id,
        state=CaseState.OPEN.value,
    )
    db.add(case)
    db.flush()
    classified = classify_event(failure_code=failure_code, note=note)
    method = ClassificationMethod.RULE.value if classified.method == "RULE" else ClassificationMethod.LLM.value
    case.root_cause = classified.root_cause
    case.classification_method = method
    if classified.method == "LLM":
        transition_case(
            db,
            case,
            to_state=CaseState.CLASSIFIED.value,
            reason=classified.reason,
            correlation_id=correlation_id,
        )
        transition_case(
            db,
            case,
            to_state=CaseState.HUMAN_REVIEW.value,
            reason="Unstructured note requires review before automated contact.",
            actor_type=ActorType.SYSTEM.value,
            correlation_id=correlation_id,
        )
        return event, case, False

    probability = score_recovery(
        root_cause=classified.root_cause,
        amount_minor=invoice.amount_minor,
        due_at=invoice.due_at,
        now=datetime.now(UTC),
        prior_contacts=0,
    )
    case.recovery_probability = probability
    transition_case(
        db,
        case,
        to_state=CaseState.CLASSIFIED.value,
        reason=classified.reason,
        correlation_id=correlation_id,
        score=probability,
    )
    next_state = CaseState.HUMAN_REVIEW.value if probability < 0.25 else CaseState.AWAITING_ACTION.value
    next_reason = (
        "Recovery probability below automated-contact threshold."
        if next_state == CaseState.HUMAN_REVIEW.value
        else "Case scored and queued for a compliant recovery action."
    )
    transition_case(
        db,
        case,
        to_state=next_state,
        reason=next_reason,
        correlation_id=correlation_id,
        score=probability,
    )
    return event, case, False
