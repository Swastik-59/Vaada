from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ActorType, CaseState, PromiseToPay, RecoveryCase, RiskTier
from app.services.audit import write_audit
from app.services.workflow import transition_case


def evaluate_case_p2p_adherence(
    db: Session,
    *,
    case: RecoveryCase,
    now: datetime | None = None,
) -> dict[str, Any]:
    """Evaluate promise-to-pay adherence, trigger T-1 reminder flags, and detect broken commitments ('Vaada Khilafi')."""
    now = now or datetime.now(UTC)
    now_date = now.date()

    promises = list(
        db.scalars(
            select(PromiseToPay)
            .where(PromiseToPay.case_id == case.id)
            .order_by(PromiseToPay.created_at.desc())
        )
    )

    if not promises:
        return {"status": "no_active_promise", "t_minus_1_sent": False, "is_broken": False}

    active_promise = promises[0]
    prom_date = active_promise.promised_date.date() if active_promise.promised_date else None

    if not prom_date:
        return {"status": "invalid_promise_date", "t_minus_1_sent": False, "is_broken": False}

    t_minus_1_triggered = False
    broken_triggered = False

    # Check for T-1 day soft touch reminder
    if now_date == (prom_date - timedelta(days=1)) and not active_promise.t_minus_1_sent:
        active_promise.t_minus_1_sent = True
        t_minus_1_triggered = True
        write_audit(
            db,
            action="case.p2p_t_minus_1_triggered",
            resource_type="recovery_case",
            resource_id=case.id,
            tenant_id=case.tenant_id,
            actor_type=ActorType.SYSTEM.value,
            payload={"promised_date": prom_date.isoformat(), "amount_minor": active_promise.amount_minor},
        )

    # Check for broken promise: current date is past promised_date + 1 day grace period
    if case.state == CaseState.PROMISE_RECORDED.value and now_date > (prom_date + timedelta(days=1)):
        active_promise.is_broken = True
        case.p2p_broken_count += 1
        
        # Escalate risk tier
        if case.p2p_broken_count >= 2:
            case.credit_risk_tier = RiskTier.CRITICAL.value
        else:
            case.credit_risk_tier = RiskTier.HIGH.value

        broken_triggered = True
        
        transition_case(
            db,
            case,
            to_state=CaseState.AWAITING_ACTION.value,
            reason=f"Promise broken (Attempt #{case.p2p_broken_count}): Promised date {prom_date.isoformat()} passed without remittance.",
            actor_type=ActorType.SYSTEM.value,
        )

        write_audit(
            db,
            action="case.promise_broken",
            resource_type="recovery_case",
            resource_id=case.id,
            tenant_id=case.tenant_id,
            actor_type=ActorType.SYSTEM.value,
            payload={
                "promised_date": prom_date.isoformat(),
                "p2p_broken_count": case.p2p_broken_count,
                "new_risk_tier": case.credit_risk_tier,
            },
        )

    db.flush()
    return {
        "status": "evaluated",
        "active_promise_id": active_promise.id,
        "promised_date": prom_date.isoformat(),
        "t_minus_1_triggered": t_minus_1_triggered,
        "broken_triggered": broken_triggered,
        "p2p_broken_count": case.p2p_broken_count,
        "credit_risk_tier": case.credit_risk_tier,
    }
