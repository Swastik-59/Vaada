from datetime import UTC, datetime
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    Customer,
    Invoice,
    PaymentReconciliation,
    PromiseToPay,
    RecoveryCase,
)
from app.services.statutory import get_43b_h_status


def get_portfolio_analytics(db: Session, tenant_id: str) -> dict:
    """
    Computes institutional portfolio analytics:
    - Receivables portfolio totals & recovery velocity
    - Section 43B(h) Income Tax disallowance exposure & 3x RBI penal interest
    - Funnel progression (Ingested -> Classified -> Contacted -> Promised -> Recovered)
    - Razorpay payment failure taxonomy distribution
    - Aging buckets (0-30, 31-60, 61-90, 90+ days)
    - Promise adherence rates
    """
    now = datetime.now(UTC)

    cases = db.execute(select(RecoveryCase).where(RecoveryCase.tenant_id == tenant_id)).scalars().all()
    invoices = db.execute(select(Invoice).where(Invoice.tenant_id == tenant_id)).scalars().all()
    promises = db.execute(select(PromiseToPay).where(PromiseToPay.tenant_id == tenant_id)).scalars().all()

    # Invoices and customers lookup maps
    invoice_map = {inv.id: inv for inv in invoices}
    customer_map = {
        c.id: c
        for c in db.execute(select(Customer).where(Customer.tenant_id == tenant_id)).scalars().all()
    }

    # 1. Totals
    total_receivables_minor = sum(inv.amount_minor for inv in invoices)
    recovered_invoices = [inv for inv in invoices if inv.status == "paid"]
    recovered_amount_minor = sum(inv.amount_minor for inv in recovered_invoices)
    
    # Active cases
    active_cases = [c for c in cases if c.state not in {"recovered", "unrecoverable", "cancelled"}]
    recovered_cases = [c for c in cases if c.state == "recovered"]

    # Calculate recoverable estimate from probability * net payable
    recoverable_estimate_minor = 0
    total_overdue_minor = 0
    total_statutory_interest_minor = 0
    msme_at_risk_count = 0
    msme_disallowed_count = 0
    msme_safe_count = 0
    tax_deduction_at_risk_minor = 0

    # Aging Buckets
    aging_buckets = {
        "0_30_days": {"count": 0, "amount_minor": 0},
        "31_60_days": {"count": 0, "amount_minor": 0},
        "61_90_days": {"count": 0, "amount_minor": 0},
        "90_plus_days": {"count": 0, "amount_minor": 0},
    }

    # Root Cause Distribution
    root_causes: dict[str, dict] = {}

    for case in cases:
        inv = invoice_map.get(case.invoice_id)
        cust = customer_map.get(case.customer_id) if case.customer_id else (customer_map.get(inv.customer_id) if inv else None)
        inv_amt = (inv.net_payable_minor if inv and inv.net_payable_minor > 0 else (inv.amount_minor if inv else 0))

        # Root cause distribution
        rc = case.root_cause or "unclassified"
        if rc not in root_causes:
            root_causes[rc] = {"count": 0, "amount_minor": 0, "recovered_count": 0}
        root_causes[rc]["count"] += 1
        root_causes[rc]["amount_minor"] += inv_amt
        if case.state == "recovered":
            root_causes[rc]["recovered_count"] += 1

        if case.state not in {"recovered", "unrecoverable", "cancelled"}:
            total_overdue_minor += inv_amt
            prob = float(case.recovery_probability) if case.recovery_probability is not None else 0.5
            recoverable_estimate_minor += int(inv_amt * prob)

            # Aging based on invoice due date
            if inv and inv.due_at:
                days_overdue = max(0, (now - inv.due_at.replace(tzinfo=UTC if inv.due_at.tzinfo is None else inv.due_at.tzinfo)).days)
                if days_overdue <= 30:
                    aging_buckets["0_30_days"]["count"] += 1
                    aging_buckets["0_30_days"]["amount_minor"] += inv_amt
                elif days_overdue <= 60:
                    aging_buckets["31_60_days"]["count"] += 1
                    aging_buckets["31_60_days"]["amount_minor"] += inv_amt
                elif days_overdue <= 90:
                    aging_buckets["61_90_days"]["count"] += 1
                    aging_buckets["61_90_days"]["amount_minor"] += inv_amt
                else:
                    aging_buckets["90_plus_days"]["count"] += 1
                    aging_buckets["90_plus_days"]["amount_minor"] += inv_amt

            # Statutory 43B(h) calculation
            if inv and cust:
                stat = get_43b_h_status(inv, cust)
                total_statutory_interest_minor += stat["statutory_interest_minor"]
                if stat["is_msme"]:
                    if stat["is_disallowed"]:
                        msme_disallowed_count += 1
                        tax_deduction_at_risk_minor += inv_amt
                    elif stat["days_remaining"] <= 10:
                        msme_at_risk_count += 1
                        tax_deduction_at_risk_minor += inv_amt
                    else:
                        msme_safe_count += 1

    # 3. Funnel Stages
    total_case_count = len(cases)
    classified_count = len([c for c in cases if c.root_cause is not None])
    contacted_count = len([c for c in cases if c.state in {"contacted", "awaiting_response", "promise_recorded", "recovered"}])
    promised_count = len([c for c in cases if c.state in {"promise_recorded", "recovered"} or c.p2p_broken_count > 0])
    recovered_count = len(recovered_cases)

    funnel = {
        "ingested": total_case_count,
        "classified": classified_count,
        "contacted": contacted_count,
        "promised": promised_count,
        "recovered": recovered_count,
        "conversion_rates": {
            "ingested_to_classified": round((classified_count / total_case_count * 100), 1) if total_case_count > 0 else 0.0,
            "classified_to_contacted": round((contacted_count / classified_count * 100), 1) if classified_count > 0 else 0.0,
            "contacted_to_promised": round((promised_count / contacted_count * 100), 1) if contacted_count > 0 else 0.0,
            "promised_to_recovered": round((recovered_count / promised_count * 100), 1) if promised_count > 0 else 0.0,
            "overall_recovery_rate": round((recovered_count / total_case_count * 100), 1) if total_case_count > 0 else 0.0,
        },
    }

    # 4. Promise Adherence Metrics
    total_promises = len(promises)
    broken_promises = len([p for p in promises if p.status == "broken" or p.is_broken])
    adherence_rate = (
        round(((total_promises - broken_promises) / total_promises) * 100, 1)
        if total_promises > 0
        else 100.0
    )

    recovery_rate_percent = (
        round((recovered_amount_minor / total_receivables_minor) * 100, 1)
        if total_receivables_minor > 0
        else 0.0
    )

    return {
        "portfolio": {
            "total_receivables_minor": total_receivables_minor,
            "total_overdue_minor": total_overdue_minor,
            "recovered_amount_minor": recovered_amount_minor,
            "recoverable_estimate_minor": recoverable_estimate_minor,
            "recovery_rate_percent": recovery_rate_percent,
            "total_cases": total_case_count,
            "active_cases": len(active_cases),
            "recovered_cases": recovered_count,
        },
        "statutory_risk": {
            "total_penal_interest_minor": total_statutory_interest_minor,
            "tax_deduction_at_risk_minor": tax_deduction_at_risk_minor,
            "msme_disallowed_count": msme_disallowed_count,
            "msme_at_risk_count": msme_at_risk_count,
            "msme_safe_count": msme_safe_count,
        },
        "funnel": funnel,
        "aging_buckets": aging_buckets,
        "root_cause_distribution": root_causes,
        "promises": {
            "total_promises": total_promises,
            "broken_promises": broken_promises,
            "adherence_rate_percent": adherence_rate,
        },
        "calculated_at": now.isoformat(),
    }
