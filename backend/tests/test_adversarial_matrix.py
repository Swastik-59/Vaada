from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

os.environ.setdefault("VAADA_JWT_SECRET", "bulletproof-secret-key-32chars-min!!")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAADA_CORS_ORIGINS", "http://localhost:3000")

from app.core.config import get_settings
from app.db.models import (
    ActorType,
    AuditEvent,
    CaseState,
    Customer,
    Invoice,
    PaymentEvent,
    RecoveryCase,
    Tenant,
    User,
)
from app.events.razorpay import generate_razorpay_signature
from app.main import create_app
from app.services.auth import issue_session, register_user
from app.services.sample_data import generate_tenant_sample_data


@pytest.fixture
def test_env():
    get_settings.cache_clear()
    app = create_app()
    client = TestClient(app)
    settings = get_settings()
    yield {"app": app, "client": client, "session_factory": app.state.session_factory, "settings": settings}


def test_unauthenticated_route_access(test_env) -> None:
    """Audit: Unauthenticated access to protected resources must fail with 401 without leakage."""
    client = test_env["client"]
    endpoints = [
        ("GET", "/api/v1/cases"),
        ("GET", "/api/v1/metrics"),
        ("GET", "/api/v1/audit"),
        ("GET", "/api/v1/invoices"),
        ("POST", "/api/v1/tenant/sample-data"),
        ("DELETE", "/api/v1/tenant/sample-data"),
    ]
    for method, path in endpoints:
        resp = client.request(method, path)
        assert resp.status_code == 401, f"Expected 401 for {method} {path}, got {resp.status_code}"
        body = resp.json()
        assert "items" not in body, f"Data leakage in 401 response for {path}"
        assert "portfolio" not in body, f"Metrics leakage in 401 response for {path}"


def test_cross_tenant_access_denied(test_env) -> None:
    """Audit: Strict IDOR/BOLA prevention. Tenant A cannot see or mutate Tenant B's cases."""
    client = test_env["client"]
    session_factory = test_env["session_factory"]
    settings = test_env["settings"]

    with session_factory() as db:
        # Tenant A
        user_a = register_user(
            db,
            email="tenant_a_op@synthetic.vaada.local",
            password="SecurePassword2026!",
            password_confirm="SecurePassword2026!",
            tenant_name="Tenant Alpha Logistics",
        )
        # Tenant B
        user_b = register_user(
            db,
            email="tenant_b_op@synthetic.vaada.local",
            password="SecurePassword2026!",
            password_confirm="SecurePassword2026!",
            tenant_name="Tenant Beta Infra",
        )
        membership_b = list(user_b.memberships)[0]
        tenant_b = db.get(Tenant, membership_b.tenant_id)
        b_data = generate_tenant_sample_data(db, tenant=tenant_b, actor_uid=user_b.uid, scenario="mixed", count=2)
        b_case_id = b_data["case_ids"][0]
        access_a, _, csrf_a, _ = issue_session(db, user=user_a, settings=settings)
        db.commit()

    headers_a = {"Authorization": f"Bearer {access_a}", "X-CSRF-Token": csrf_a}

    # User A attempts to GET Tenant B's case
    get_resp = client.get(f"/api/v1/cases/{b_case_id}", headers=headers_a)
    assert get_resp.status_code == 404, f"Expected 404 for cross-tenant case get, got {get_resp.status_code}"

    # User A attempts to act on Tenant B's case
    act_resp = client.post(
        f"/api/v1/cases/{b_case_id}/actions",
        json={"action": "send_reminder", "reason": "Unauthorized attack"},
        headers=headers_a,
    )
    assert act_resp.status_code == 404, f"Expected 404 for cross-tenant case action, got {act_resp.status_code}"


def test_forged_webhook_signature_rejected(test_env) -> None:
    """Audit: Webhooks with forged or invalid HMAC signatures must be rejected immediately."""
    client = test_env["client"]
    payload = {
        "entity": "event",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_forged_123",
                    "amount": 5000000,
                    "currency": "INR",
                    "status": "captured",
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    forged_signature = "bad_hmac_signature_00000000000000000000000000000000000000000000"

    resp = client.post(
        "/api/v1/webhooks/razorpay",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Razorpay-Signature": forged_signature,
        },
    )
    assert resp.status_code in {401, 403}, f"Forged webhook should be rejected, got {resp.status_code}"


def test_duplicate_webhook_replay_protection(test_env) -> None:
    """Audit: Duplicate webhooks must be idempotent, return duplicate status, and never duplicate actions."""
    client = test_env["client"]
    session_factory = test_env["session_factory"]
    settings = test_env["settings"]

    with session_factory() as db:
        user = register_user(
            db,
            email="replay_test_op@synthetic.vaada.local",
            password="SecurePassword2026!",
            password_confirm="SecurePassword2026!",
            tenant_name="Replay Test Corp",
        )
        membership = list(user.memberships)[0]
        tenant = db.get(Tenant, membership.tenant_id)
        sample = generate_tenant_sample_data(db, tenant=tenant, actor_uid=user.uid, scenario="payment_failures", count=1)
        case_id = sample["case_ids"][0]
        case = db.get(RecoveryCase, case_id)
        invoice = db.get(Invoice, case.invoice_id)
        invoice_number = invoice.invoice_number
        invoice_amount = invoice.amount_minor
        db.commit()

    secret = settings.razorpay_webhook_secret or "vaada_rzp_test_secret_2026"
    payment_id = f"pay_replay_test_{int(datetime.now(UTC).timestamp())}"
    payload = {
        "entity": "event",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": payment_id,
                    "amount": invoice_amount,
                    "currency": "INR",
                    "status": "failed",
                    "method": "upi",
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_reason": "insufficient_funds",
                    "notes": {
                        "invoice_number": invoice_number,
                    },
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    sig = generate_razorpay_signature(body=raw_body, secret=secret)
    headers = {"Content-Type": "application/json", "X-Razorpay-Signature": sig}

    # First delivery
    resp1 = client.post("/api/v1/webhooks/razorpay", content=raw_body, headers=headers)
    assert resp1.status_code == 200
    assert resp1.json().get("status") == "failure_ingested"

    # Replay delivery
    resp2 = client.post("/api/v1/webhooks/razorpay", content=raw_body, headers=headers)
    assert resp2.status_code == 200
    res2_json = resp2.json()
    assert res2_json.get("duplicate") is True, "Replay should be flagged duplicate"
    assert res2_json.get("status") == "duplicate_ignored"


def test_concurrent_case_mutation_optimistic_locking(test_env) -> None:
    """Audit: Concurrent mutations with stale expected_version must fail with 409 Conflict."""
    client = test_env["client"]
    session_factory = test_env["session_factory"]
    settings = test_env["settings"]

    with session_factory() as db:
        user = register_user(
            db,
            email="concurrency_op@synthetic.vaada.local",
            password="SecurePassword2026!",
            password_confirm="SecurePassword2026!",
            tenant_name="Concurrency Test Ltd",
        )
        membership = list(user.memberships)[0]
        membership.role = "manager"
        tenant = db.get(Tenant, membership.tenant_id)
        sample = generate_tenant_sample_data(db, tenant=tenant, actor_uid=user.uid, scenario="mixed", count=1)
        case_id = sample["case_ids"][0]
        case = db.get(RecoveryCase, case_id)
        case.state = CaseState.AWAITING_ACTION.value
        initial_version = case.version
        access, _, csrf, _ = issue_session(db, user=user, settings=settings)
        db.commit()

    headers = {"Authorization": f"Bearer {access}", "X-CSRF-Token": csrf}

    # First mutation succeeds (transitions version to initial_version + 1)
    resp1 = client.post(
        f"/api/v1/cases/{case_id}/actions",
        json={"action": "pause", "reason": "Operator grace period", "expected_version": initial_version},
        headers=headers,
    )
    assert resp1.status_code == 200
    assert resp1.json()["case"]["version"] > initial_version

    # Second concurrent mutation arrives with stale initial_version -> MUST fail with 409
    resp2 = client.post(
        f"/api/v1/cases/{case_id}/actions",
        json={"action": "resume", "reason": "Conflicting mutation", "expected_version": initial_version},
        headers=headers,
    )
    assert resp2.status_code == 409, f"Concurrent mutation with stale version should fail with 409, got {resp2.status_code}"


def test_malformed_ai_output_safely_diverts_to_human_review(test_env) -> None:
    """Audit: LLM hallucinating impossible amount or malformed output must never mutate financial balance and must divert to human review."""
    client = test_env["client"]
    session_factory = test_env["session_factory"]
    settings = test_env["settings"]

    with session_factory() as db:
        user = register_user(
            db,
            email="ai_guard_op@synthetic.vaada.local",
            password="SecurePassword2026!",
            password_confirm="SecurePassword2026!",
            tenant_name="AI Guard Test Corp",
        )
        membership = list(user.memberships)[0]
        tenant = db.get(Tenant, membership.tenant_id)
        sample = generate_tenant_sample_data(db, tenant=tenant, actor_uid=user.uid, scenario="mixed", count=1)
        case_id = sample["case_ids"][0]
        case = db.get(RecoveryCase, case_id)
        invoice = db.get(Invoice, case.invoice_id)
        original_balance = invoice.net_payable_minor

        # Set case to AWAITING_RESPONSE
        case.state = CaseState.AWAITING_RESPONSE.value
        case_version = case.version
        access, _, csrf, _ = issue_session(db, user=user, settings=settings)
        db.commit()

    headers = {"Authorization": f"Bearer {access}", "X-CSRF-Token": csrf}

    # Customer reply with vague promise
    resp = client.post(
        f"/api/v1/cases/{case_id}/customer-replies",
        json={"message": "Hum shaayad agle saal ya kabhi de denge dekhte hain", "expected_version": case_version},
        headers=headers,
    )
    assert resp.status_code == 200

    with session_factory() as db:
        updated_case = db.get(RecoveryCase, case_id)
        # Must divert to human review because validation rejected vague promise
        assert updated_case.state == CaseState.HUMAN_REVIEW.value
        invoice = db.get(Invoice, updated_case.invoice_id)
        # Financial state must NOT have changed
        assert invoice.net_payable_minor == original_balance
        assert invoice.status != "paid"


def test_production_mode_locks_evaluator_shortcuts(test_env) -> None:
    """Audit: In production mode with demo_mode=False, sample data generation and simulator are hard blocked."""
    client = test_env["client"]
    session_factory = test_env["session_factory"]
    settings = test_env["settings"]

    with session_factory() as db:
        user = register_user(
            db,
            email="prod_audit_op@synthetic.vaada.local",
            password="SecurePassword2026!",
            password_confirm="SecurePassword2026!",
            tenant_name="Production Audit Corp",
        )
        access, _, csrf, _ = issue_session(db, user=user, settings=settings)
        db.commit()

    headers = {"Authorization": f"Bearer {access}", "X-CSRF-Token": csrf}

    original_env = settings.env
    original_demo = settings.demo_mode
    try:
        settings.env = "production"
        settings.demo_mode = False

        # Attempt sample data generation
        gen_resp = client.post(
            "/api/v1/tenant/sample-data",
            json={"scenario": "mixed", "count": 5},
            headers=headers,
        )
        assert gen_resp.status_code in {401, 403}, f"Sample data in prod should be blocked, got {gen_resp.status_code}"

        # Attempt webhook simulation
        sim_resp = client.post(
            "/api/v1/webhooks/simulator",
            json={"scenario": "payment_successful"},
            headers=headers,
        )
        assert sim_resp.status_code in {401, 403}, f"Webhook simulator in prod should be blocked, got {sim_resp.status_code}"
    finally:
        settings.env = original_env
        settings.demo_mode = original_demo
