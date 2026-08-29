from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import Customer, Invoice, Membership, Role, Tenant, User
from app.main import create_app


def _client_with_users() -> TestClient:
    get_settings.cache_clear()
    app = create_app()
    db = app.state.session_factory()
    try:
        tenant = Tenant(slug="acme", name="Acme", legal_name="Acme Private Limited")
        db.add(tenant)
        db.flush()
        manager = User(email="manager@acme.test", password_hash=hash_password("password12"), is_active=True)
        viewer = User(email="viewer@acme.test", password_hash=hash_password("password12"), is_active=True)
        db.add_all([manager, viewer])
        db.flush()
        db.add_all(
            [
                Membership(user_id=manager.id, tenant_id=tenant.id, role=Role.MANAGER.value),
                Membership(user_id=viewer.id, tenant_id=tenant.id, role=Role.VIEWER.value),
            ]
        )
        customer = Customer(
            tenant_id=tenant.id,
            external_ref="C1",
            display_name="Buyer",
            contact_channel="email",
            contact_value="buyer@example.test",
        )
        db.add(customer)
        db.flush()
        db.add(
            Invoice(
                tenant_id=tenant.id,
                customer_id=customer.id,
                invoice_number="INV-1",
                amount_minor=100000,
                currency="INR",
                issued_at=datetime.now(UTC) - timedelta(days=10),
                due_at=datetime.now(UTC) - timedelta(days=3),
                status="overdue",
            )
        )
        db.commit()
    finally:
        db.close()
    return TestClient(app)


def _login(client: TestClient, email: str) -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "password12"})
    assert response.status_code == 200


def test_login_succeeds_for_valid_credentials() -> None:
    client = _client_with_users()
    response = client.post("/api/v1/auth/login", json={"email": "manager@acme.test", "password": "password12"})
    assert response.status_code == 200
    assert "vaayda_access" in response.cookies


def test_viewer_cannot_ingest_events() -> None:
    client = _client_with_users()
    _login(client, "viewer@acme.test")
    csrf = client.cookies.get("vaayda_csrf")
    response = client.post(
        "/api/v1/events",
        headers={"X-CSRF-Token": csrf or ""},
        json={
            "source": "synthetic",
            "provider_event_id": "evt-1",
            "invoice_id": "not-a-real-id",
            "event_type": "payment.failed",
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert response.status_code in {401, 403, 404}


def test_mutating_request_without_csrf_is_rejected() -> None:
    client = _client_with_users()
    _login(client, "manager@acme.test")
    response = client.post(
        "/api/v1/events",
        json={
            "source": "synthetic",
            "provider_event_id": "evt-2",
            "invoice_id": "not-a-real-id",
            "event_type": "payment.failed",
            "occurred_at": datetime.now(UTC).isoformat(),
        },
    )
    assert response.status_code == 401
