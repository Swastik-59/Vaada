from datetime import UTC, datetime, timedelta
import pytest
from sqlalchemy.orm import Session

from app.db.models import (
    ActorType,
    CaseState,
    Customer,
    Invoice,
    PaymentEvent,
    PromiseToPay,
    RecoveryCase,
    Tenant,
    User,
)
from app.services.jobs import (
    is_within_ist_contact_window,
    run_analytics_aggregation,
    run_compliance_window_sweeper,
    run_promise_adherence_check,
    run_stale_case_monitor,
)


from uuid import uuid4
from app.main import create_app


@pytest.fixture
def jobs_fixture():
    app = create_app()
    db_session = app.state.session_factory()
    try:
        suffix = uuid4().hex[:8]
        tenant = Tenant(name="Jobs Test Tenant", slug=f"jobs-tenant-{suffix}", legal_name="Jobs Test Tenant Private Limited")
        db_session.add(tenant)
        db_session.flush()

        customer = Customer(
            tenant_id=tenant.id,
            external_ref=f"CUST-JOB-{suffix}",
            display_name="Job Test Customer Ltd",
            contact_channel="email",
            contact_value="finance@jobtest.in",
            is_msme=True,
        )
        db_session.add(customer)
        db_session.flush()

        invoice = Invoice(
            tenant_id=tenant.id,
            customer_id=customer.id,
            invoice_number=f"INV-JOB-{suffix}",
            amount_minor=5000000,
            net_payable_minor=5000000,
            currency="INR",
            issued_at=datetime.now(UTC) - timedelta(days=20),
            due_at=datetime.now(UTC) - timedelta(days=5),
            status="overdue",
        )
        db_session.add(invoice)
        db_session.flush()

        evt = PaymentEvent(
            tenant_id=tenant.id,
            source="razorpay",
            provider_event_id=f"evt_job_{suffix}",
            invoice_id=invoice.id,
            customer_id=customer.id,
            event_type="payment.failed",
            payload_json="{}",
            occurred_at=datetime.now(UTC),
        )
        db_session.add(evt)
        db_session.flush()

        case = RecoveryCase(
            tenant_id=tenant.id,
            invoice_id=invoice.id,
            customer_id=customer.id,
            source_event_id=evt.id,
            state=CaseState.PROMISE_RECORDED.value,
            recovery_probability=0.75,
            root_cause="temporary_liquidity_crunch",
            credit_risk_tier="MEDIUM",
        )
        db_session.add(case)
        db_session.flush()

        yield {
            "tenant": tenant,
            "customer": customer,
            "invoice": invoice,
            "case": case,
            "db": db_session,
            "app": app,
        }
    finally:
        db_session.rollback()
        db_session.close()


def test_promise_adherence_detects_broken_promise(jobs_fixture):
    f = jobs_fixture
    db = f["db"]
    case = f["case"]
    tenant = f["tenant"]

    # Create promise whose promised_date was yesterday
    past_promise = PromiseToPay(
        tenant_id=tenant.id,
        case_id=case.id,
        amount_minor=5000000,
        promised_date=datetime.now(UTC) - timedelta(days=1),
        confidence=0.9,
        raw_text="Kal payment ho jayegi pakka.",
        language_mix="hi-en",
        status="recorded",
    )
    db.add(past_promise)
    db.flush()

    result = run_promise_adherence_check(db, tenant_id=tenant.id)
    assert result["broken_promises_detected"] >= 1

    db.refresh(past_promise)
    assert past_promise.status == "broken"
    assert past_promise.is_broken is True

    db.refresh(case)
    assert case.state == CaseState.AWAITING_ACTION.value


def test_promise_adherence_detects_t_minus_1_reminder(jobs_fixture):
    f = jobs_fixture
    db = f["db"]
    case = f["case"]
    tenant = f["tenant"]

    # Create promise due in 20 hours
    tomorrow_promise = PromiseToPay(
        tenant_id=tenant.id,
        case_id=case.id,
        amount_minor=5000000,
        promised_date=datetime.now(UTC) + timedelta(hours=20),
        confidence=0.9,
        raw_text="Will settle tomorrow afternoon.",
        language_mix="en",
        status="recorded",
        t_minus_1_sent=False,
    )
    db.add(tomorrow_promise)
    db.flush()

    result = run_promise_adherence_check(db, tenant_id=tenant.id)
    assert result["t_minus_1_reminders_triggered"] >= 1

    db.refresh(tomorrow_promise)
    assert tomorrow_promise.t_minus_1_sent is True


def test_ist_contact_window_evaluation():
    # 04:00 UTC = 09:30 IST (Within window)
    in_window_utc = datetime(2026, 9, 2, 4, 0, tzinfo=UTC)  # Wednesday
    assert is_within_ist_contact_window(in_window_utc) is True

    # 17:00 UTC = 22:30 IST (Night, outside window)
    night_utc = datetime(2026, 9, 2, 17, 0, tzinfo=UTC)
    assert is_within_ist_contact_window(night_utc) is False

    # Sunday test: 06:00 UTC = 11:30 IST on Sunday (Prohibited)
    sunday_utc = datetime(2026, 9, 6, 6, 0, tzinfo=UTC)
    assert is_within_ist_contact_window(sunday_utc) is False


def test_compliance_window_sweeper(jobs_fixture):
    f = jobs_fixture
    db = f["db"]
    tenant = f["tenant"]

    res = run_compliance_window_sweeper(db, tenant_id=tenant.id)
    assert "in_contact_window" in res
    assert "current_ist_time" in res
    assert "status" in res


def test_stale_case_monitor(jobs_fixture):
    f = jobs_fixture
    db = f["db"]
    case = f["case"]
    tenant = f["tenant"]

    # Set case to OPEN and created_at to 10 days ago
    case.state = CaseState.OPEN.value
    case.created_at = datetime.now(UTC) - timedelta(days=10)
    db.flush()

    res = run_stale_case_monitor(db, tenant_id=tenant.id, stale_days=7)
    assert res["stale_cases_flagged"] >= 1


def test_analytics_aggregation(jobs_fixture):
    f = jobs_fixture
    db = f["db"]
    tenant = f["tenant"]

    res = run_analytics_aggregation(db, tenant_id=tenant.id)
    assert res["total_cases"] >= 1
    assert res["total_invoiced_minor"] >= 5000000
    assert "recovery_rate_percent" in res


def test_jobs_trigger_endpoint(jobs_fixture):
    from fastapi.testclient import TestClient
    from app.core.security import hash_password
    from app.db.models import Membership, Role

    f = jobs_fixture
    db = f["db"]
    tenant = f["tenant"]
    app = f["app"]

    test_email = f"operator_job_{uuid4().hex[:6]}@test.in"
    user = User(
        email=test_email,
        password_hash=hash_password("password12"),
        is_active=True,
    )
    db.add(user)
    db.flush()

    membership = Membership(
        user_id=user.id,
        tenant_id=tenant.id,
        role=Role.ADMIN.value,
    )
    db.add(membership)
    db.commit()

    client = TestClient(app)
    login_res = client.post("/api/v1/auth/login", json={"email": test_email, "password": "password12"})
    assert login_res.status_code == 200

    csrf_token = client.cookies.get("vaada_csrf")
    resp = client.post(
        "/api/v1/jobs/trigger",
        json={"job_name": "all", "stale_days": 7},
        headers={"X-CSRF-Token": csrf_token},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["triggered_job"] == "all"
    assert "promise_adherence" in body["results"]
    assert "stale_cases" in body["results"]
    assert "compliance_sweeper" in body["results"]
    assert "analytics" in body["results"]

