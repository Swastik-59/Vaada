from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import Conflict
from app.db.models import ActorType, CaseState, CaseTransition, RecoveryCase, WorkflowActionRecord
from app.services.audit import write_audit

ALLOWED: dict[str, dict[str, str]] = {
    CaseState.OPEN.value: {CaseState.CLASSIFIED.value: "classification_complete"},
    CaseState.CLASSIFIED.value: {
        CaseState.AWAITING_ACTION.value: "scored",
        CaseState.HUMAN_REVIEW.value: "needs_review",
    },
    CaseState.AWAITING_ACTION.value: {
        CaseState.CONTACTED.value: "outbound_sent",
        CaseState.HUMAN_REVIEW.value: "escalated",
        CaseState.PAUSED.value: "paused",
        CaseState.BLOCKED.value: "compliance_block",
        CaseState.CANCELLED.value: "cancelled",
        CaseState.RECOVERED.value: "payment_reconciled",
    },
    CaseState.CONTACTED.value: {
        CaseState.AWAITING_RESPONSE.value: "awaiting_customer",
        CaseState.PAUSED.value: "paused",
        CaseState.HUMAN_REVIEW.value: "escalated",
        CaseState.RECOVERED.value: "payment_reconciled",
    },
    CaseState.AWAITING_RESPONSE.value: {
        CaseState.PROMISE_RECORDED.value: "promise_extracted",
        CaseState.HUMAN_REVIEW.value: "extraction_failed",
        CaseState.AWAITING_ACTION.value: "retry_contact",
        CaseState.UNRECOVERABLE.value: "closed_unrecoverable",
        CaseState.PAUSED.value: "paused",
        CaseState.RECOVERED.value: "payment_reconciled",
    },
    CaseState.PROMISE_RECORDED.value: {
        CaseState.RECOVERED.value: "promise_honoured",
        CaseState.AWAITING_ACTION.value: "promise_broken",
        CaseState.HUMAN_REVIEW.value: "escalated",
    },
    CaseState.HUMAN_REVIEW.value: {
        CaseState.AWAITING_ACTION.value: "human_resumed",
        CaseState.PAUSED.value: "paused",
        CaseState.RECOVERED.value: "human_marked_recovered",
        CaseState.UNRECOVERABLE.value: "human_closed",
        CaseState.CANCELLED.value: "cancelled",
    },
    CaseState.PAUSED.value: {
        CaseState.AWAITING_ACTION.value: "resumed",
        CaseState.CANCELLED.value: "cancelled",
        CaseState.RECOVERED.value: "payment_reconciled",
    },
    CaseState.BLOCKED.value: {
        CaseState.HUMAN_REVIEW.value: "sent_to_review",
        CaseState.AWAITING_ACTION.value: "compliance_cleared",
        CaseState.PROMISE_RECORDED.value: "debtor_promised",
        CaseState.RECOVERED.value: "payment_reconciled",
        CaseState.CANCELLED.value: "cancelled",
    },
}


def transition_case(
    db: Session,
    case: RecoveryCase,
    *,
    to_state: str,
    reason: str,
    actor_type: str = ActorType.SYSTEM.value,
    actor_id: str | None = None,
    correlation_id: str | None = None,
    score: float | None = None,
    action_id: str | None = None,
    expected_version: int | None = None,
) -> CaseTransition:
    if expected_version is not None and case.version != expected_version:
        raise Conflict("Case was modified by another actor. Refresh and retry.")
    allowed = ALLOWED.get(case.state, {})
    if to_state not in allowed:
        raise Conflict(f"Transition from {case.state} to {to_state} is not permitted.")
    record = CaseTransition(
        tenant_id=case.tenant_id,
        case_id=case.id,
        from_state=case.state,
        to_state=to_state,
        reason=reason,
        actor_type=actor_type,
        actor_id=actor_id,
        correlation_id=correlation_id,
        score=score,
        action_id=action_id,
    )
    case.state = to_state
    case.version += 1
    case.last_action_at = datetime.now(UTC)
    db.add(record)
    write_audit(
        db,
        action="case.transitioned",
        resource_type="recovery_case",
        resource_id=case.id,
        tenant_id=case.tenant_id,
        actor_type=actor_type,
        actor_id=actor_id,
        correlation_id=correlation_id,
        payload={"from": record.from_state, "to": to_state, "reason": reason},
    )
    db.flush()
    return record


def record_action(
    db: Session,
    case: RecoveryCase,
    *,
    action_type: str,
    status: str,
    reason: str,
    actor_type: str,
    actor_id: str | None,
    correlation_id: str | None,
    idempotency_key: str | None = None,
) -> WorkflowActionRecord:
    if idempotency_key:
        existing = db.scalar(
            select(WorkflowActionRecord).where(
                WorkflowActionRecord.tenant_id == case.tenant_id,
                WorkflowActionRecord.idempotency_key == idempotency_key,
            )
        )
        if existing:
            return existing
    record = WorkflowActionRecord(
        tenant_id=case.tenant_id,
        case_id=case.id,
        action_type=action_type,
        status=status,
        reason=reason,
        actor_type=actor_type,
        actor_id=actor_id,
        idempotency_key=idempotency_key,
        correlation_id=correlation_id,
    )
    db.add(record)
    db.flush()
    return record
