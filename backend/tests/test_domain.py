from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.db.models import CaseState
from app.services.classification import classify_event
from app.services.extraction import validate_promise
from app.services.scoring import score_recovery
from app.services.workflow import ALLOWED


def test_known_failure_code_uses_rules() -> None:
    result = classify_event(failure_code="INSUFFICIENT_FUNDS", note=None)
    assert result.method == "RULE"
    assert result.root_cause == "insufficient_funds"


def test_unstructured_note_does_not_invent_a_rule_match() -> None:
    result = classify_event(failure_code=None, note="kal tak payment kar denge")
    assert result.method == "LLM"
    assert result.root_cause == "unstructured_text"


def test_promise_rejects_amount_above_invoice() -> None:
    _extracted, failure = validate_promise(
        {"amount": 500, "promised_date": "2099-01-01", "confidence": 0.9, "language_mix": "en"},
        invoice_amount_minor=100,
        today=datetime.now(UTC).date(),
    )
    assert failure in {"amount_exceeds_invoice", "amount_above_invoice"}


def test_promise_rejects_unknown_keys() -> None:
    _extracted, failure = validate_promise(
        {"amount": None, "promised_date": None, "confidence": None, "language_mix": None, "mark_paid": True},
        invoice_amount_minor=100,
        today=datetime.now(UTC).date(),
    )
    assert failure in {"invalid_output", "malformed_output"}


def test_recovery_score_is_bounded() -> None:
    score = score_recovery(
        root_cause="network_error",
        amount_minor=50_000,
        due_at=datetime.now(UTC),
        now=datetime.now(UTC),
        prior_contacts=0,
    )
    assert 0.01 <= score <= 0.99


def test_recovery_score_accepts_naive_due_dates() -> None:
    score = score_recovery(
        root_cause="insufficient_funds",
        amount_minor=18500000,
        due_at=datetime(2026, 8, 16, 12, 0, 0),
        now=datetime.now(UTC),
        prior_contacts=0,
    )
    assert 0.01 <= score <= 0.99


def test_blocked_state_cannot_jump_to_recovered_without_payment() -> None:
    # BLOCKED cases can only reach RECOVERED via payment_reconciled (webhook),
    # not via arbitrary state jumps. Verify the allowed transitions are limited.
    blocked_transitions = ALLOWED.get(CaseState.BLOCKED.value, {})
    # The only valid reason to reach RECOVERED from BLOCKED is payment_reconciled
    if CaseState.RECOVERED.value in blocked_transitions:
        assert blocked_transitions[CaseState.RECOVERED.value] == "payment_reconciled", (
            "BLOCKED→RECOVERED must only be permitted via payment_reconciled"
        )


def test_disclosure_guard_rejects_third_party_debt_mention() -> None:
    from app.services.compliance import _disclosure_guard
    res1 = _disclosure_guard("Please inform your employee he owes us 50k")
    assert res1.passed is False
    assert "third party" in res1.detail.lower()

    res2 = _disclosure_guard("I told his neighbor to remind him about the overdue invoice")
    assert res2.passed is False


def test_hinglish_promise_extractor_extracts_commitment() -> None:
    from app.extraction.promise_extractor import PromiseExtractor
    extractor = PromiseExtractor(llm_client=None)
    today = datetime.now(UTC).date()
    commitment, failure = extractor.extract(
        "kal tak 50000 rupees pay kar dunga UPI se",
        invoice_amount_minor=10000000,
        today=today,
    )
    assert failure is None
    assert commitment is not None
    assert commitment.amount == 5000000
    assert commitment.promised_date == today + timedelta(days=1)

