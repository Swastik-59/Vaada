from __future__ import annotations

import os
from datetime import UTC, datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.cookies import ACCESS_COOKIE, CSRF_COOKIE
from app.api.routes import router
from app.authz.deps import Principal, get_db
from app.core.config import Settings, get_settings
from app.core.security import create_access_token, new_csrf_token
from app.db.models import AuditEvent, Base, Customer, Invoice, Membership, PaymentEvent, RecoveryCase, Tenant, User
from app.main import app
from app.services.ingestion import ingest_payment_event
from app.services.razorpay import (
    RazorpayTaxonomyService,
    derive_recovery_policy,
    evaluate_combined_case_decision,
    get_taxonomy_service,
    normalize_razorpay_error,
)

TEST_DB_URL = "sqlite+pysqlite:///:memory:"


@pytest.fixture
def db_session() -> Session:
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session: Session) -> TestClient:
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seeded_env(db_session: Session) -> dict:
    tenant = Tenant(slug="test-corp", name="Test Corp", legal_name="Test Corp Pvt Ltd")
    user = User(email="test@vaada.local", password_hash="dummy")
    db_session.add_all([tenant, user])
    db_session.flush()

    membership = Membership(user_id=user.id, tenant_id=tenant.id, role="operator")
    db_session.add(membership)

    customer = Customer(
        tenant_id=tenant.id,
        external_ref="CUST-001",
        display_name="Acme Corp",
        contact_channel="email",
        contact_value="acme@example.com",
    )
    db_session.add(customer)
    db_session.flush()

    invoice = Invoice(
        tenant_id=tenant.id,
        customer_id=customer.id,
        invoice_number="INV-TEST-001",
        amount_minor=1850000,
        currency="INR",
        issued_at=datetime.now(UTC),
        due_at=datetime.now(UTC),
    )
    db_session.add(invoice)
    db_session.flush()

    return {"tenant": tenant, "user": user, "customer": customer, "invoice": invoice}


def _auth_cookies(tenant_id: str, user_id: str, email: str = "test@vaada.local") -> tuple[dict[str, str], dict[str, str]]:
    settings = get_settings()
    token = create_access_token(user_id=user_id, settings=settings)
    csrf = new_csrf_token()
    cookies = {ACCESS_COOKIE: token, CSRF_COOKIE: csrf}
    headers = {"X-CSRF-Token": csrf, "X-Vaada-Tenant-Id": tenant_id}
    return cookies, headers


# ---------------------------------------------------------------------------
# UNIT TESTS: Taxonomy Lookup & Normalizer
# ---------------------------------------------------------------------------


def test_razorpay_taxonomy_exact_code_and_reason_lookup():
    svc = get_taxonomy_service()
    entry = svc.lookup(code="BAD_REQUEST_ERROR", reason="insufficient_funds")
    assert entry is not None
    assert entry.provider == "razorpay"
    assert entry.code == "BAD_REQUEST_ERROR"
    assert entry.reason == "insufficient_funds"
    assert entry.source == "customer"
    assert entry.step == "payment_debit"
    assert "insufficient balance" in entry.description.lower()
    assert entry.official_source_url.startswith("https://razorpay.com/docs/errors/")


def test_razorpay_taxonomy_method_and_reason_lookup():
    svc = get_taxonomy_service()
    entry = svc.lookup(payment_method="upi", reason="invalid_vpa")
    assert entry is not None
    assert entry.payment_method == "upi"
    assert entry.reason == "invalid_vpa"
    assert entry.step == "payment_initiation"


def test_razorpay_taxonomy_exact_code_fallback():
    svc = get_taxonomy_service()
    entry = svc.lookup(code="GATEWAY_ERROR")
    assert entry is not None
    assert entry.code == "GATEWAY_ERROR"


def test_razorpay_unknown_unmapped_error_no_hallucination():
    svc = get_taxonomy_service()
    # Test completely non-existent error code & reason
    entry = svc.lookup(code="NON_EXISTENT_CODE", reason="hallucinated_reason")
    assert entry is None

    # Test normalizer with unmapped payload
    norm = normalize_razorpay_error({
        "error": {
            "code": "STRANGE_INTERNAL_CODE_99",
            "reason": "mysterious_quantum_drop",
            "description": "Some exotic drop",
        }
    })
    assert norm["matched"] is False
    assert norm["official"] is None
    assert norm["raw"]["code"] == "STRANGE_INTERNAL_CODE_99"
    assert norm["raw"]["reason"] == "mysterious_quantum_drop"
    # Derived policy must safely flag for human review
    assert norm["derived"]["recoverability"] == "needs_investigation"
    assert norm["derived"]["requires_human_review"] is True
    assert norm["derived"]["is_unmapped"] is True


def test_razorpay_missing_fields_and_malformed_payload():
    # Null payload
    norm_null = normalize_razorpay_error(None)
    assert norm_null["matched"] is False
    assert norm_null["raw"]["code"] is None

    # Empty payload
    norm_empty = normalize_razorpay_error({})
    assert norm_empty["matched"] is False

    # String / invalid type in place of error block
    norm_invalid = normalize_razorpay_error({"error": "not a dict", "code": "BAD_REQUEST_ERROR", "reason": "invalid_otp"})
    assert norm_invalid["raw"]["code"] == "BAD_REQUEST_ERROR"


def test_razorpay_taxonomy_metadata_and_version():
    svc = get_taxonomy_service()
    meta = svc.get_metadata()
    assert meta["provider"] == "razorpay"
    assert meta["source"] == "official_documentation"
    assert "razorpay-taxonomy-" in meta["taxonomy_version"]
    assert len(meta["source_urls"]) >= 4
    for url in meta["source_urls"]:
        assert url.startswith("https://razorpay.com/docs/errors/")


def test_derived_recovery_policy_mapping():
    svc = get_taxonomy_service()
    insufficient = svc.lookup(code="BAD_REQUEST_ERROR", reason="insufficient_funds")
    derived_insufficient = derive_recovery_policy(insufficient)
    assert derived_insufficient["recoverability"] == "recoverable"
    assert derived_insufficient["retryable"] is True
    assert derived_insufficient["requires_human_review"] is False
    assert derived_insufficient["policy_decision"] == "SEND_RETRY_PROMPT"

    mandate_cancelled = svc.lookup(code="BAD_REQUEST_ERROR", reason="mandate_cancelled")
    derived_mandate = derive_recovery_policy(mandate_cancelled)
    assert derived_mandate["recoverability"] == "unrecoverable"
    assert derived_mandate["retryable"] is False
    assert derived_mandate["requires_human_review"] is True


def test_combined_payment_failure_and_customer_promise_reasoning():
    svc = get_taxonomy_service()
    entry = svc.lookup(code="BAD_REQUEST_ERROR", reason="insufficient_funds")

    # Scenario: Razorpay insufficient_funds + Customer promise "Friday tak pakka kar dunga"
    decision = evaluate_combined_case_decision(
        taxonomy_entry=entry,
        raw_payload={"code": "BAD_REQUEST_ERROR", "reason": "insufficient_funds"},
        customer_message="bhai abhi balance nahi hai, Friday tak pakka kar dunga",
        promise_to_pay={"promised_date": "2026-09-05T00:00:00Z", "confidence": 0.94},
        broken_p2p_count=0,
        statutory_days_remaining=12,
    )

    assert decision["final_policy"] == "WAIT_FOR_PROMISED_DATE"
    assert decision["confidence"] == 0.94
    assert decision["recoverability"] == "recoverable"

    # Verify that the decision trace chain contains all 5 key stations
    chain = decision["decision_trace_chain"]
    stages = [item["stage"] for item in chain]
    assert "PAYMENT_FAILURE" in stages
    assert "TAXONOMY_MATCH" in stages
    assert "OFFICIAL_GUIDANCE" in stages
    assert "CUSTOMER_MESSAGE" in stages
    assert "PROMISE_DETECTED" in stages
    assert "RECOVERY_POLICY" in stages


def test_combined_broken_promise_escalation():
    svc = get_taxonomy_service()
    entry = svc.lookup(code="BAD_REQUEST_ERROR", reason="insufficient_funds")

    decision = evaluate_combined_case_decision(
        taxonomy_entry=entry,
        raw_payload={"code": "BAD_REQUEST_ERROR", "reason": "insufficient_funds"},
        customer_message="kal kar dunga",
        promise_to_pay={"promised_date": "2026-09-02T00:00:00Z", "confidence": 0.85},
        broken_p2p_count=2,  # Repeated broken promises!
        statutory_days_remaining=3,
    )

    assert decision["final_policy"] == "ESCALATE_REPEATED_BROKEN_PROMISE"
    chain = decision["decision_trace_chain"]
    stages = [item["stage"] for item in chain]
    assert "PROMISE_BROKEN" in stages
    assert "STATUTORY_WARNING" in stages


# ---------------------------------------------------------------------------
# INTEGRATION TESTS: Ingestion, Audit & REST Endpoints
# ---------------------------------------------------------------------------


def test_ingestion_records_taxonomy_audit(db_session: Session, seeded_env: dict):
    tenant = seeded_env["tenant"]
    invoice = seeded_env["invoice"]

    rzp_payload = {
        "error": {
            "code": "BAD_REQUEST_ERROR",
            "reason": "insufficient_funds",
            "source": "customer",
            "step": "payment_debit",
            "description": "The customer's bank account has insufficient balance.",
            "payment_method": "upi",
        }
    }

    event, case, dup = ingest_payment_event(
        db_session,
        tenant=tenant,
        source="razorpay",
        provider_event_id="RZP-TEST-EVT-001",
        invoice=invoice,
        event_type="payment.failed",
        payload=rzp_payload,
        occurred_at=datetime.now(UTC),
        failure_code="INSUFFICIENT_FUNDS",
        note=None,
        correlation_id="test-corr-001",
    )

    assert case is not None
    assert case.root_cause == "insufficient_funds"

    # Check audit log for taxonomy match
    audit = db_session.execute(
        select(AuditEvent).where(
            AuditEvent.resource_id == case.id,
            AuditEvent.action == "taxonomy.matched",
        )
    ).scalar_one_or_none()

    assert audit is not None
    assert "insufficient_funds" in audit.payload_json


def test_taxonomy_api_list_and_filters(client: TestClient, db_session: Session, seeded_env: dict):
    tenant = seeded_env["tenant"]
    user = seeded_env["user"]
    cookies, headers = _auth_cookies(tenant.id, user.id)

    # 1. List all
    res = client.get("/api/v1/razorpay/taxonomy", cookies=cookies, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["total"] > 0
    assert "metadata" in data

    # 2. Filter by UPI
    res_upi = client.get("/api/v1/razorpay/taxonomy?payment_method=upi", cookies=cookies, headers=headers)
    assert res_upi.status_code == 200
    data_upi = res_upi.json()
    for item in data_upi["items"]:
        assert item["official"]["payment_method"] == "upi"

    # 3. Filter by recoverability
    res_rec = client.get("/api/v1/razorpay/taxonomy?recoverability=recoverable", cookies=cookies, headers=headers)
    assert res_rec.status_code == 200
    for item in res_rec.json()["items"]:
        assert item["derived"]["recoverability"] == "recoverable"


def test_taxonomy_api_lookup_endpoint(client: TestClient, db_session: Session, seeded_env: dict):
    tenant = seeded_env["tenant"]
    user = seeded_env["user"]
    cookies, headers = _auth_cookies(tenant.id, user.id)

    # Lookup official error
    payload = {
        "code": "BAD_REQUEST_ERROR",
        "reason": "invalid_vpa",
        "payment_method": "upi",
    }
    res = client.post("/api/v1/razorpay/lookup", json=payload, cookies=cookies, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["matched"] is True
    assert data["official"]["reason"] == "invalid_vpa"
    assert data["derived"]["policy_decision"] == "DISPATCH_DYNAMIC_QR"

    # Lookup unmapped error
    unmapped_payload = {
        "code": "UNKNOWN_ERROR_999",
        "reason": "unrecognized_reason_xyz",
    }
    res_unmapped = client.post("/api/v1/razorpay/lookup", json=unmapped_payload, cookies=cookies, headers=headers)
    assert res_unmapped.status_code == 200
    data_unmapped = res_unmapped.json()
    assert data_unmapped["matched"] is False
    assert data_unmapped["official"] is None
    assert data_unmapped["derived"]["requires_human_review"] is True


def test_case_detail_shows_payment_diagnosis_and_recovery_interpretation(
    client: TestClient,
    db_session: Session,
    seeded_env: dict,
):
    tenant = seeded_env["tenant"]
    user = seeded_env["user"]
    invoice = seeded_env["invoice"]
    cookies, headers = _auth_cookies(tenant.id, user.id)

    # Ingest event with official Razorpay failure
    rzp_payload = {
        "error": {
            "code": "BAD_REQUEST_ERROR",
            "reason": "insufficient_funds",
            "source": "customer",
            "step": "payment_debit",
            "description": "Insufficient funds in bank account.",
            "payment_method": "upi",
        },
        "payment_method": "upi",
    }
    _event, case, _dup = ingest_payment_event(
        db_session,
        tenant=tenant,
        source="razorpay",
        provider_event_id="RZP-DIAG-TEST",
        invoice=invoice,
        event_type="payment.failed",
        payload=rzp_payload,
        occurred_at=datetime.now(UTC),
        failure_code="INSUFFICIENT_FUNDS",
        note=None,
        correlation_id="diag-test",
    )

    res = client.get(f"/api/v1/cases/{case.id}", cookies=cookies, headers=headers)
    assert res.status_code == 200
    case_detail = res.json()

    # Verify official diagnosis separation
    diagnosis = case_detail.get("payment_diagnosis")
    assert diagnosis is not None
    assert diagnosis["matched"] is True
    assert diagnosis["code"] == "BAD_REQUEST_ERROR"
    assert diagnosis["reason"] == "insufficient_funds"
    assert diagnosis["source"] == "customer"
    assert diagnosis["step"] == "payment_debit"
    assert diagnosis["official_source_url"].startswith("https://razorpay.com/docs/errors/")

    # Verify derived interpretation separation
    interpretation = case_detail.get("recovery_interpretation")
    assert interpretation is not None
    assert interpretation["recoverability"] == "recoverable"
    assert interpretation["retryable"] is True
    assert interpretation["policy_decision"] == "SEND_RETRY_PROMPT"

    # Verify decision chain exists
    chain = case_detail.get("decision_chain")
    assert chain is not None
    assert len(chain) >= 3
