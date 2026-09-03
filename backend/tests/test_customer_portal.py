from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
import os
import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("VAADA_JWT_SECRET", "test-secret-value-32chars-min")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAADA_CORS_ORIGINS", "http://localhost:3000")

from app.core.config import get_settings
from app.db.models import CaseState, Customer, DisputeStatus, Invoice, PaymentEvent, RecoveryCase, Tenant
from app.main import create_app
from app.services.portal import generate_portal_token, verify_portal_token

get_settings.cache_clear()


@pytest.fixture
def client_and_fixtures():
    app = create_app()
    db = app.state.session_factory()
    try:
        tenant = Tenant(slug="portal-corp", name="Portal Corp", legal_name="Portal Corp Private Limited")
        db.add(tenant)
        db.flush()

        customer = Customer(
            tenant_id=tenant.id,
            external_ref="CUST-PORTAL-1",
            display_name="Apex Infrastructure Ltd",
            gstin="27AAACA0000A1Z5",
            contact_channel="email",
            contact_value="finance@apexinfra.test",
            is_msme=True,
            msme_category="micro",
        )
        db.add(customer)
        db.flush()

        invoice = Invoice(
            tenant_id=tenant.id,
            customer_id=customer.id,
            invoice_number="INV-PORTAL-001",
            amount_minor=12500000,
            net_payable_minor=12500000,
            currency="INR",
            issued_at=datetime.now(UTC) - timedelta(days=20),
            due_at=datetime.now(UTC) - timedelta(days=5),
            status="overdue",
        )
        db.add(invoice)
        db.flush()

        evt = PaymentEvent(
            tenant_id=tenant.id,
            source="razorpay",
            provider_event_id="evt_portal_test",
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
            state=CaseState.AWAITING_RESPONSE.value,
        )
        db.add(case)
        db.flush()
        db.commit()

        token = generate_portal_token(
            case_id=case.id,
            invoice_id=invoice.id,
            tenant_id=tenant.id,
            expires_in_days=7,
        )

        client = TestClient(app)
        yield {
            "client": client,
            "db": db,
            "tenant": tenant,
            "customer": customer,
            "invoice": invoice,
            "case": case,
            "token": token,
        }
    finally:
        db.close()


def test_portal_dossier_fetch(client_and_fixtures):
    f = client_and_fixtures
    client = f["client"]
    token = f["token"]

    res = client.get(f"/api/v1/portal/{token}")
    assert res.status_code == 200
    data = res.json()

    assert data["invoice"]["invoice_number"] == "INV-PORTAL-001"
    assert data["invoice"]["net_payable_minor"] == 12500000
    assert data["supplier"]["name"] == "Portal Corp"
    assert data["customer"]["display_name"] == "Apex Infrastructure Ltd"
    assert data["customer"]["is_msme"] is True
    assert data["statutory"]["is_msme"] is True


def test_portal_token_expiry_validation():
    expired_token = generate_portal_token(
        case_id="case_1",
        invoice_id="inv_1",
        tenant_id="ten_1",
        expires_in_days=-1,
    )
    with pytest.raises(Exception):
        verify_portal_token(expired_token)


def test_portal_commit_promise(client_and_fixtures):
    f = client_and_fixtures
    client = f["client"]
    token = f["token"]
    db = f["db"]
    case = f["case"]

    future_date = (date.today() + timedelta(days=5)).isoformat()
    res = client.post(
        f"/api/v1/portal/{token}/promise",
        json={
            "promised_date": future_date,
            "raw_message": "Account clear by Friday.",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "promise_recorded"
    assert data["promised_date"] == future_date

    # Verify case state in DB transitioned to promise_recorded
    db.refresh(case)
    assert case.state == CaseState.PROMISE_RECORDED.value


def test_portal_raise_dispute(client_and_fixtures):
    f = client_and_fixtures
    client = f["client"]
    token = f["token"]
    db = f["db"]
    case = f["case"]
    invoice = f["invoice"]

    res = client.post(
        f"/api/v1/portal/{token}/dispute",
        json={
            "dispute_type": "tds_deducted",
            "notes": "TDS of 2% has already been deducted under Section 194C.",
            "tds_rate_percent": 2.0,
            "acknowledgement_ref": "ACK-194C-99988",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "dispute_recorded"

    db.refresh(case)
    db.refresh(invoice)
    assert invoice.dispute_status == DisputeStatus.TDS_DEDUCTED.value
    assert "ACK-194C-99988" in invoice.dispute_notes
    assert case.state == CaseState.HUMAN_REVIEW.value


def test_portal_pay_settlement(client_and_fixtures):
    f = client_and_fixtures
    client = f["client"]
    token = f["token"]
    db = f["db"]
    case = f["case"]
    invoice = f["invoice"]

    res = client.post(
        f"/api/v1/portal/{token}/pay",
        json={
            "payment_method": "upi",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "payment_reconciled"
    assert data["amount_minor"] == 12500000
    assert data["new_case_state"] == "recovered"

    db.refresh(case)
    db.refresh(invoice)
    assert case.state == CaseState.RECOVERED.value
    assert invoice.status == "paid"
    assert invoice.net_payable_minor == 0
