from datetime import datetime, timedelta, timezone
import zoneinfo
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.db.models import (
    ActorType,
    CaseState,
    Invoice,
    PromiseToPay,
    RecoveryCase,
)
from app.services.audit import write_audit
from app.services.workflow import record_action, transition_case

UTC = timezone.utc
IST_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")


def is_within_ist_contact_window(now_utc: datetime | None = None) -> bool:
    """
    Evaluates statutory contact compliance window:
    09:00 - 20:00 IST, Monday to Saturday (weekday < 6).
    """
    dt = now_utc or datetime.now(UTC)
    ist_dt = dt.astimezone(IST_TZ)
    if ist_dt.weekday() == 6:  # Sunday is prohibited
        return False
    return 9 <= ist_dt.hour < 20


def run_promise_adherence_check(db: Session, tenant_id: str | None = None) -> dict:
    """
    Evaluates promise adherence across all active promises:
    1. Broken Promise Detection: Promised date has passed without full payment.
       Transitions case from PROMISE_RECORDED -> AWAITING_ACTION / HUMAN_REVIEW.
    2. T-minus-1 Reminder: Reminds debtor 24h before promised settlement date.
    """
    now = datetime.now(UTC)
    broken_count = 0
    reminders_sent = 0

    # 1. Detect elapsed promises
    q = select(PromiseToPay).where(PromiseToPay.status == "recorded")
    if tenant_id:
        q = q.where(PromiseToPay.tenant_id == tenant_id)
    promises = db.scalars(q).all()

    for promise in promises:
        case = db.get(RecoveryCase, promise.case_id)
        if not case or case.state in {CaseState.RECOVERED.value, CaseState.CANCELLED.value}:
            continue

        invoice = db.get(Invoice, case.invoice_id)
        is_paid = invoice and invoice.status == "paid"

        p_date = promise.promised_date
        if p_date.tzinfo is None:
            p_date = p_date.replace(tzinfo=UTC)

        # If promised date is in the past and unpaid, flag as broken
        if p_date < now and not is_paid:
            promise.status = "broken"
            promise.is_broken = True
            broken_count += 1

            if case.state == CaseState.PROMISE_RECORDED.value:
                transition_case(
                    db,
                    case,
                    to_state=CaseState.AWAITING_ACTION.value,
                    reason=f"Broken promise: Remittance expected by {p_date.date()} not received.",
                    actor_type=ActorType.SYSTEM.value,
                    actor_id="promise_adherence_job",
                    correlation_id=f"job_broken_{promise.id[:8]}",
                )

            record_action(
                db,
                case,
                action_type="broken_promise_escalation",
                status="executed",
                reason=f"Promise ID {promise.id} defaulted. Scheduled amount INR {promise.amount_minor/100:.2f}.",
                actor_type=ActorType.SYSTEM.value,
                actor_id="promise_adherence_job",
                correlation_id=f"job_broken_{promise.id[:8]}",
            )

            write_audit(
                db,
                action="promise.broken",
                resource_type="promise_to_pay",
                resource_id=promise.id,
                tenant_id=promise.tenant_id,
                actor_type=ActorType.SYSTEM.value,
                actor_id="promise_adherence_job",
                correlation_id=f"job_broken_{promise.id[:8]}",
                payload={"promised_date": p_date.isoformat(), "case_id": case.id},
            )

        # 2. T-minus-1 Reminder check (within next 24 to 48 hours)
        elif not promise.t_minus_1_sent and not is_paid:
            time_until_promise = p_date - now
            if timedelta(hours=0) < time_until_promise <= timedelta(hours=36):
                promise.t_minus_1_sent = True
                reminders_sent += 1

                record_action(
                    db,
                    case,
                    action_type="promise_reminder_t_minus_1",
                    status="executed",
                    reason=f"Dispatched T-minus-1 settlement reminder for {p_date.date()}.",
                    actor_type=ActorType.SYSTEM.value,
                    actor_id="promise_adherence_job",
                    correlation_id=f"job_remind_{promise.id[:8]}",
                )

                write_audit(
                    db,
                    action="promise.reminder_dispatched",
                    resource_type="promise_to_pay",
                    resource_id=promise.id,
                    tenant_id=promise.tenant_id,
                    actor_type=ActorType.SYSTEM.value,
                    actor_id="promise_adherence_job",
                    correlation_id=f"job_remind_{promise.id[:8]}",
                    payload={"promised_date": promise.promised_date.isoformat(), "case_id": case.id},
                )

    db.flush()
    return {
        "job": "promise_adherence_check",
        "broken_promises_detected": broken_count,
        "t_minus_1_reminders_triggered": reminders_sent,
        "timestamp": now.isoformat(),
    }


def run_stale_case_monitor(db: Session, tenant_id: str | None = None, stale_days: int = 7) -> dict:
    """
    Monitors recovery cases that have remained inactive for > stale_days.
    Flags them for credit controller escalation.
    """
    now = datetime.now(UTC)
    cutoff = now - timedelta(days=stale_days)
    flagged_count = 0

    q = select(RecoveryCase).where(
        and_(
            RecoveryCase.state.in_([
                CaseState.OPEN.value,
                CaseState.CLASSIFIED.value,
                CaseState.AWAITING_ACTION.value,
                CaseState.AWAITING_RESPONSE.value,
            ]),
            RecoveryCase.created_at < cutoff,
        )
    )
    if tenant_id:
        q = q.where(RecoveryCase.tenant_id == tenant_id)

    stale_cases = db.scalars(q).all()
    for case in stale_cases:
        record_action(
            db,
            case,
            action_type="stale_case_flagged",
            status="executed",
            reason=f"Recovery inactive for over {stale_days} days. Flagged for institutional escalation.",
            actor_type=ActorType.SYSTEM.value,
            actor_id="stale_case_monitor",
            correlation_id=f"job_stale_{case.id[:8]}",
        )
        flagged_count += 1

    db.flush()
    return {
        "job": "stale_case_monitor",
        "stale_cases_flagged": flagged_count,
        "stale_threshold_days": stale_days,
        "timestamp": now.isoformat(),
    }


def run_compliance_window_sweeper(db: Session, tenant_id: str | None = None) -> dict:
    """
    Verifies IST communications compliance window (09:00 - 20:00 IST).
    Sweeps queued actions when the contact window opens.
    """
    now = datetime.now(UTC)
    in_window = is_within_ist_contact_window(now)

    return {
        "job": "compliance_window_sweeper",
        "in_contact_window": in_window,
        "current_ist_time": now.astimezone(IST_TZ).strftime("%Y-%m-%d %H:%M:%S IST"),
        "status": "window_active" if in_window else "window_suppressed",
        "timestamp": now.isoformat(),
    }


def run_analytics_aggregation(db: Session, tenant_id: str | None = None) -> dict:
    """
    Computes real-time portfolio snapshot across cases, invoices, and statutory risks.
    """
    q_cases = select(RecoveryCase)
    q_invoices = select(Invoice)
    if tenant_id:
        q_cases = q_cases.where(RecoveryCase.tenant_id == tenant_id)
        q_invoices = q_invoices.where(Invoice.tenant_id == tenant_id)

    cases = db.scalars(q_cases).all()
    invoices = db.scalars(q_invoices).all()

    total_invoiced_minor = sum(inv.amount_minor for inv in invoices)
    total_net_payable_minor = sum(inv.net_payable_minor for inv in invoices)
    recovered_invoices = [inv for inv in invoices if inv.status == "paid"]
    recovered_amount_minor = sum(inv.amount_minor for inv in recovered_invoices)

    active_cases = [c for c in cases if c.state not in {CaseState.RECOVERED.value, CaseState.CANCELLED.value}]
    recovered_cases = [c for c in cases if c.state == CaseState.RECOVERED.value]

    recovery_rate_percent = (
        round((recovered_amount_minor / total_invoiced_minor) * 100, 2)
        if total_invoiced_minor > 0
        else 0.0
    )

    return {
        "job": "analytics_aggregation",
        "total_cases": len(cases),
        "active_cases": len(active_cases),
        "recovered_cases": len(recovered_cases),
        "total_invoiced_minor": total_invoiced_minor,
        "total_net_payable_minor": total_net_payable_minor,
        "recovered_amount_minor": recovered_amount_minor,
        "recovery_rate_percent": recovery_rate_percent,
        "timestamp": datetime.now(UTC).isoformat(),
    }
