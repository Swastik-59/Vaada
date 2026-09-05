from __future__ import annotations

import os
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

os.environ.setdefault("VAADA_JWT_SECRET", "bulletproof-secret-key-32chars-min!!")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")

from app.core.config import get_settings
from app.core.identity import generate_user_uid
from app.core.security import create_access_token, hash_password
from app.db.models import (
    AuditEvent,
    Customer,
    Invoice,
    Membership,
    PaymentEvent,
    RecoveryCase,
    Tenant,
    User,
    UserStatus,
)
from app.main import create_app
from app.services.sample_data import SYNTHETIC_SOURCE, clear_tenant_sample_data, generate_tenant_sample_data


@pytest.fixture
def test_setup():
    get_settings.cache_clear()
    app = create_app()
    db = app.state.session_factory()
    try:
        t1 = Tenant(slug="sample-tenant-1", name="Acme Precision", legal_name="Acme Precision Pvt Ltd")
        t2 = Tenant(slug="sample-tenant-2", name="Beta Motors", legal_name="Beta Motors Ltd")
        db.add_all([t1, t2])
        db.flush()

        u1_uid = generate_user_uid()
        u1 = User(
            uid=u1_uid,
            email="admin@acme.local",
            password_hash=hash_password("ValidPassword123!"),
            status=UserStatus.ACTIVE.value,
            session_version=1,
        )
        db.add(u1)
        db.flush()

        m1 = Membership(user_id=u1.id, tenant_id=t1.id, role="admin")
        db.add(m1)
        db.commit()

        yield {
            "app": app,
            "db": db,
            "tenant_1": t1,
            "tenant_2": t2,
            "user_1": u1,
            "user_1_uid": u1_uid,
        }
    finally:
        db.close()


def test_generate_sample_data_relational_consistency(test_setup):
    db = test_setup["db"]
    t1 = test_setup["tenant_1"]
    actor_uid = test_setup["user_1_uid"]

    result = generate_tenant_sample_data(
        db,
        tenant=t1,
        actor_uid=actor_uid,
        scenario="mixed",
        count=6,
    )

    assert result["status"] == "success"
    assert result["cases_created"] == 6
    assert result["source"] == SYNTHETIC_SOURCE

    # Verify invoices created and bound strictly to tenant 1
    invoices = db.scalars(select(Invoice).where(Invoice.tenant_id == t1.id)).all()
    assert len(invoices) == 6
    for inv in invoices:
        assert inv.invoice_number.startswith("INV-SYN-")
        assert inv.amount_minor > 0
        assert inv.customer_id is not None

    # Verify cases and payment events
    cases = db.scalars(select(RecoveryCase).where(RecoveryCase.tenant_id == t1.id)).all()
    assert len(cases) == 6
    for c in cases:
        assert c.source_event_id is not None
        assert c.root_cause is not None

    # Verify audit trail captures actor_uid
    audit_events = db.scalars(
        select(AuditEvent).where(
            AuditEvent.tenant_id == t1.id,
            AuditEvent.action == "tenant.sample_data_generated",
        )
    ).all()
    assert len(audit_events) >= 1
    assert audit_events[0].actor_uid == actor_uid


def test_sample_data_tenant_isolation(test_setup):
    db = test_setup["db"]
    t1 = test_setup["tenant_1"]
    t2 = test_setup["tenant_2"]
    actor_uid = test_setup["user_1_uid"]

    generate_tenant_sample_data(db, tenant=t1, actor_uid=actor_uid, scenario="mixed", count=4)

    # Tenant 2 must have 0 records
    t2_invoices = db.scalars(select(Invoice).where(Invoice.tenant_id == t2.id)).all()
    assert len(t2_invoices) == 0

    t2_cases = db.scalars(select(RecoveryCase).where(RecoveryCase.tenant_id == t2.id)).all()
    assert len(t2_cases) == 0


def test_clear_sample_data(test_setup):
    db = test_setup["db"]
    t1 = test_setup["tenant_1"]
    actor_uid = test_setup["user_1_uid"]

    generate_tenant_sample_data(db, tenant=t1, actor_uid=actor_uid, scenario="mixed", count=5)
    cases_before = db.scalars(select(RecoveryCase).where(RecoveryCase.tenant_id == t1.id)).all()
    assert len(cases_before) == 5

    # Clear sample data
    res = clear_tenant_sample_data(db, tenant=t1, actor_uid=actor_uid)
    assert res["status"] == "cleared"
    assert res["invoices_removed"] == 5

    cases_after = db.scalars(select(RecoveryCase).where(RecoveryCase.tenant_id == t1.id)).all()
    assert len(cases_after) == 0


def test_api_sample_data_endpoint(test_setup):
    app = test_setup["app"]
    u1 = test_setup["user_1"]
    t1 = test_setup["tenant_1"]

    settings = get_settings()
    token = create_access_token(
        user_uid=u1.uid,
        session_jti="jti_test_session",
        session_version=1,
        settings=settings,
    )

    client = TestClient(app)

    # 1. Unauthenticated request must fail
    res_unauth = client.post("/api/v1/tenant/sample-data", json={"scenario": "mixed", "count": 4})
    assert res_unauth.status_code == 401

    # 2. Authenticated request succeeds
    res = client.post(
        "/api/v1/tenant/sample-data",
        json={"scenario": "mixed", "count": 4},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["cases_created"] == 4

    # 3. GET /api/v1/cases should now return the newly generated items
    cases_res = client.get("/api/v1/cases", headers={"Authorization": f"Bearer {token}"})
    assert cases_res.status_code == 200
    cases_data = cases_res.json()
    assert len(cases_data["items"]) == 4
    assert cases_data["metrics"]["open_cases"] >= 1
