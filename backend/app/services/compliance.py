from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import ComplianceCheck, OutboundCommunication

IST = ZoneInfo("Asia/Kolkata")


@dataclass(frozen=True)
class RuleResult:
    rule_id: str
    title: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class ComplianceDecision:
    allowed: bool
    results: list[RuleResult]
    failed_rule_ids: list[str]


PROHIBITED_TONE = (
    "threat",
    "threaten",
    "police",
    "arrest",
    "legal notice",
    "defame",
    "shame",
    "harass",
    "violence",
    "break your",
)


def evaluate_compliance(
    db: Session,
    *,
    tenant_id: str,
    case_id: str,
    action_type: str,
    message: str,
    merchant_legal_name: str,
    settings: Settings,
    now: datetime | None = None,
) -> ComplianceDecision:
    now = now or datetime.now(UTC)
    results = [
        _contact_window(now, settings),
        _frequency_limit(db, tenant_id=tenant_id, case_id=case_id, settings=settings, now=now),
        _tone_guardrail(message),
        _disclosure_guard(message),
        _identity_requirement(message, merchant_legal_name),
    ]
    failed = [item.rule_id for item in results if not item.passed]
    decision = ComplianceDecision(allowed=not failed, results=results, failed_rule_ids=failed)
    db.add(
        ComplianceCheck(
            tenant_id=tenant_id,
            case_id=case_id,
            action_type=action_type,
            decision="ALLOW" if decision.allowed else "BLOCK",
            results_json=json.dumps([item.__dict__ for item in results]),
            failed_rule_ids=",".join(failed),
        )
    )
    db.flush()
    return decision


def _contact_window(now: datetime, settings: Settings) -> RuleResult:
    local = now.astimezone(IST)
    start = time(settings.contact_window_start_hour, 0)
    end = time(settings.contact_window_end_hour, 0)
    passed = start <= local.time() < end and local.weekday() < 6
    return RuleResult(
        rule_id="contact_window",
        title="Contact window",
        passed=passed,
        detail="Outbound contact is permitted 09:00–20:00 IST, Monday–Saturday."
        if passed
        else f"Blocked: local time {local.strftime('%A %H:%M IST')} is outside the contact window.",
    )


def _frequency_limit(db: Session, *, tenant_id: str, case_id: str, settings: Settings, now: datetime) -> RuleResult:
    since = now - timedelta(days=7)
    count = db.scalar(
        select(func.count(OutboundCommunication.id)).where(
            OutboundCommunication.tenant_id == tenant_id,
            OutboundCommunication.case_id == case_id,
            OutboundCommunication.blocked.is_(False),
            OutboundCommunication.created_at >= since,
        )
    )
    used = int(count or 0)
    passed = used < settings.max_contacts_per_7_days
    return RuleResult(
        rule_id="frequency_limit",
        title="Frequency limit",
        passed=passed,
        detail=f"{used} of {settings.max_contacts_per_7_days} contacts used in 7 days."
        if passed
        else "Blocked: rolling 7-day contact cap reached.",
    )


def _tone_guardrail(message: str) -> RuleResult:
    lowered = message.lower()
    hit = next((term for term in PROHIBITED_TONE if term in lowered), None)
    return RuleResult(
        rule_id="tone_guardrail",
        title="Tone guardrail",
        passed=hit is None,
        detail="No prohibited coercive language detected."
        if hit is None
        else f"Blocked: prohibited language matched ({hit}).",
    )


def _disclosure_guard(message: str) -> RuleResult:
    lowered = message.lower()
    third_party = any(term in lowered for term in ("your employee", "his wife", "her husband", "neighbour", "neighbor"))
    return RuleResult(
        rule_id="disclosure_guard",
        title="Disclosure guard",
        passed=not third_party,
        detail="Message is addressed through an authorised customer channel."
        if not third_party
        else "Blocked: message appears to disclose debt details to a third party.",
    )


def _identity_requirement(message: str, legal_name: str) -> RuleResult:
    passed = legal_name.lower() in message.lower()
    return RuleResult(
        rule_id="identity_requirement",
        title="Identity requirement",
        passed=passed,
        detail="Sending organisation is identified."
        if passed
        else "Blocked: outbound message must identify the sending organisation.",
    )
