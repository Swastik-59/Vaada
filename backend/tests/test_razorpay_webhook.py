from __future__ import annotations

import json
import os
from datetime import UTC, datetime

import pytest
from sqlalchemy import select

os.environ.setdefault("VAADA_JWT_SECRET", "test-secret-value-32chars-min")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAADA_CORS_ORIGINS", "http://localhost:3000")

from app.core.config import get_settings
from app.db.models import CaseState, Customer, Invoice, PaymentEvent, RecoveryCase, Tenant
from app.events.razorpay import generate_razorpay_signature
from app.main import create_app
from app.services.razorpay_webhook import handle_razorpay_webhook

get_settings.cache_clear()


@pytest.fixture
def db():
    app = create_app()
    session = app.state.session_factory()
    try:
        yield session
    finally:
        session.close()


def test_razorpay_webhook_signature_validation(db):
    secret = "test_secret_12345"
    payload = {"event": "payment.failed", "payload": {"payment": {"entity": {"id": "pay_test_001"}}}}
    raw_body = json.dumps(payload).encode("utf-8")

    # Invalid signature should raise
    with pytest.raises(Exception):
        handle_razorpay_webhook(
            db,
            raw_body=raw_body,
            signature="invalid_sig",
            secret=secret,
        )


def test_razorpay_webhook_payment_failed_ingestion(db):
    secret = "test_secret_12345"

    tenant = Tenant(slug="rzp-test-tenant", name="RZP Tenant", legal_name="RZP Tenant Private Limited")
    db.add(tenant)
    db.flush()

    customer = Customer(
        tenant_id=tenant.id,
        external_ref="CUST-RZP-1",
        display_name="Acme Corp",
        contact_channel="email",
        contact_value="finance@acme.com",
    )
    db.add(customer)
    db.flush()

    invoice = Invoice(
        tenant_id=tenant.id,
        customer_id=customer.id,
        invoice_number="INV-RZP-TEST-1",
        amount_minor=5000000,
        net_payable_minor=5000000,
        currency="INR",
        issued_at=datetime.now(UTC),
        due_at=datetime.now(UTC),
        status="overdue",
    )
    db.add(invoice)
    db.flush()

    payload = {
        "entity": "event",
        "event": "payment.failed",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_fail_999",
                    "amount": 5000000,
                    "currency": "INR",
                    "status": "failed",
                    "method": "upi",
                    "notes": {"invoice_number": invoice.invoice_number},
                    "error_code": "BAD_REQUEST_ERROR",
                    "error_reason": "insufficient_funds",
                    "error_description": "Declined due to insufficient funds.",
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    signature = generate_razorpay_signature(body=raw_body, secret=secret)

    result = handle_razorpay_webhook(
        db,
        raw_body=raw_body,
        signature=signature,
        secret=secret,
        tenant_override=tenant,
    )

    assert result["accepted"] is True
    assert result["status"] == "failure_ingested"
    assert result["invoice_number"] == invoice.invoice_number

    # Verify recovery case created
    case = db.get(RecoveryCase, result["case_id"])
    assert case is not None
    assert case.invoice_id == invoice.id
    assert case.root_cause == "insufficient_funds"

    # Verify idempotency on repeat
    duplicate_res = handle_razorpay_webhook(
        db,
        raw_body=raw_body,
        signature=signature,
        secret=secret,
        tenant_override=tenant,
    )
    assert duplicate_res["accepted"] is True
    assert duplicate_res["duplicate"] is True
    assert duplicate_res["status"] == "duplicate_ignored"


def test_razorpay_webhook_payment_captured_reconciliation(db):
    secret = "test_secret_12345"

    tenant = Tenant(slug="rzp-cap-tenant", name="Cap Tenant", legal_name="Cap Tenant Pvt Ltd")
    db.add(tenant)
    db.flush()

    customer = Customer(
        tenant_id=tenant.id,
        external_ref="CUST-CAP-1",
        display_name="Beta Logistics",
        contact_channel="phone",
        contact_value="+919876543210",
    )
    db.add(customer)
    db.flush()

    invoice = Invoice(
        tenant_id=tenant.id,
        customer_id=customer.id,
        invoice_number="INV-CAP-TEST-1",
        amount_minor=2500000,
        net_payable_minor=2500000,
        currency="INR",
        issued_at=datetime.now(UTC),
        due_at=datetime.now(UTC),
        status="overdue",
    )
    db.add(invoice)
    db.flush()

    # Pre-create an active case
    evt = PaymentEvent(
        tenant_id=tenant.id,
        source="razorpay",
        provider_event_id="initial_fail_evt",
        invoice_id=invoice.id,
        customer_id=customer.id,
        event_type="payment.failed",
        payload_json="{}",
        occurred_at=datetime.now(UTC),
    )
    db.add(evt)
    db.flush()

    case = RecoveryCase(
        tenant_id=tenant.id,
        invoice_id=invoice.id,
        customer_id=customer.id,
        source_event_id=evt.id,
        state=CaseState.AWAITING_ACTION.value,
    )
    db.add(case)
    db.flush()

    payload = {
        "entity": "event",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_success_123",
                    "amount": 2500000,
                    "currency": "INR",
                    "status": "captured",
                    "method": "upi",
                    "notes": {"invoice_number": invoice.invoice_number},
                    "acquirer_data": {"bank_transaction_id": "UTR_TEST_SUCCESS_99"},
                }
            }
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    signature = generate_razorpay_signature(body=raw_body, secret=secret)

    result = handle_razorpay_webhook(
        db,
        raw_body=raw_body,
        signature=signature,
        secret=secret,
        tenant_override=tenant,
    )

    assert result["accepted"] is True
    assert result["status"] == "payment_reconciled"
    assert result["amount_minor"] == 2500000
    assert result["reference_number"] == "UTR_TEST_SUCCESS_99"

    # Verify case transitioned to RECOVERED and invoice paid
    db.refresh(case)
    db.refresh(invoice)
    assert case.state == CaseState.RECOVERED.value
    assert invoice.status == "paid"
    assert invoice.net_payable_minor == 0
