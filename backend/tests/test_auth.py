from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

os.environ.setdefault("VAAYDA_JWT_SECRET", "test-secret-value-32chars-min")
os.environ.setdefault("VAAYDA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAAYDA_CORS_ORIGINS", "http://localhost:3000")

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.models import Customer, Invoice, Membership, Role, Tenant, User
from app.main import create_app
from app.seed import seed_demo

get_settings.cache_clear()


def _seeded_client() -> TestClient:
    get_settings.cache_clear()
    app = create_app()
    db = app.state.session_factory()
    try:
        tenant = Tenant(slug="acme", name="Acme", legal_name="Acme Private Limited")
        db.add(tenant)
        db.flush()
        manager = User(email="manager@acme.test", password_hash=hash_password("password12"), is_active=True)
        db.add(manager)
        db.flush()
        db.add(Membership(user_id=manager.id, tenant_id=tenant.id, role=Role.MANAGER.value))
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


def test_health() -> None:
    client = TestClient(create_app())
    assert client.get("/health").status_code == 200


def test_login_rejects_bad_password() -> None:
    client = _seeded_client()
    response = client.post("/api/v1/auth/login", json={"email": "manager@acme.test", "password": "wrongpass1"})
    assert response.status_code == 401
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "authentication_failed"


def test_seed_creates_operator_login() -> None:
    previous = os.environ.get("VAAYDA_SEED_ADMIN_PASSWORD")
    os.environ["VAAYDA_SEED_ADMIN_PASSWORD"] = "local-seed-pass-12"
    try:
        get_settings.cache_clear()
        app = create_app()
        db = app.state.session_factory()
        try:
            seed_demo(db, get_settings())
            db.commit()
        finally:
            db.close()
        client = TestClient(app)
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "operator@vaayda.local", "password": "local-seed-pass-12"},
        )
        assert response.status_code == 200
    finally:
        if previous is None:
            os.environ.pop("VAAYDA_SEED_ADMIN_PASSWORD", None)
        else:
            os.environ["VAAYDA_SEED_ADMIN_PASSWORD"] = previous
        get_settings.cache_clear()


def test_unauthenticated_cases_are_rejected() -> None:
    client = _seeded_client()
    assert client.get("/api/v1/cases").status_code == 401
