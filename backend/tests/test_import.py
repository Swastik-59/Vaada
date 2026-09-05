from __future__ import annotations

import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

os.environ.setdefault("VAADA_JWT_SECRET", "bulletproof-secret-key-32chars-min!!")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAADA_CORS_ORIGINS", "http://localhost:3000")

from app.core.config import get_settings
from app.db.models import AuditEvent, Customer, Invoice, RecoveryCase, Tenant
from app.main import create_app
from app.services.auth import issue_session, register_user
from app.services.importer import sanitize_csv_cell


@pytest.fixture
def test_env():
    get_settings.cache_clear()
    app = create_app()
    client = TestClient(app)
    settings = get_settings()
    yield {"app": app, "client": client, "session_factory": app.state.session_factory, "settings": settings}


def test_sanitize_csv_cell_formula_injection():
    # ASVS V1.2 / CWE-1236 Formula Injection Defense
    assert sanitize_csv_cell("=1+1") == "'=1+1"
    assert sanitize_csv_cell("+cmd|'/C calc'!A0") == "'+cmd|'/C calc'!A0"
    assert sanitize_csv_cell("-500") == "'-500"
    assert sanitize_csv_cell("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert sanitize_csv_cell("\tTabbed") == "'\tTabbed"
    assert sanitize_csv_cell("Normal Text") == "Normal Text"
    assert sanitize_csv_cell(None) == ""


def test_valid_csv_import(test_env):
    client = test_env["client"]
    factory = test_env["session_factory"]

    with factory() as db:
        user = register_user(db, email="importer_valid@test.com", password="Password123!@#", password_confirm="Password123!@#", tenant_name="Import Org")
        tenant = db.scalar(select(Tenant).where(Tenant.id == user.memberships[0].tenant_id))
        access, _, csrf, _ = issue_session(db, user=user, settings=test_env["settings"])
        user_uid = user.uid
        tenant_id = tenant.id
        db.commit()

    csv_data = (
        "invoice_number,customer_name,amount,due_date,issued_date,contact_value,gstin,pan,is_msme,msme_category\n"
        "INV-IMP-001,Pinnacle Engineering Ltd,150000.00,2026-08-30,2026-07-15,+919876543210,27AAACP1234F1Z5,AAACP1234F,true,Small\n"
        "INV-IMP-002,Sahyadri Logistics Corp,280000,2026-09-05,2026-08-01,sahya@corp.in,27AABCS5678G1Z2,AABCS5678G,false,\n"
    )

    response = client.post(
        "/api/v1/invoices/import",
        json={"csv_text": csv_data},
        headers={
            "X-CSRF-Token": csrf,
            "Authorization": f"Bearer {access}",
        },
        cookies={
            "vaada_access": access,
            "vaada_csrf": csrf,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["success"] is True
    assert data["imported_count"] == 2
    assert data["duplicate_count"] == 0
    assert data["error_count"] == 0
    assert data["total_amount_minor"] == 43000000  # ₹4,30,000 in paise

    # Verify database persistence
    with factory() as db:
        invoices = db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all()
        assert len(invoices) == 2

        # Verify Customer
        customer = db.scalar(select(Customer).where(Customer.tenant_id == tenant_id, Customer.display_name == "Pinnacle Engineering Ltd"))
        assert customer is not None
        assert customer.is_msme is True
        assert customer.msme_category == "Small"

        # Verify Cases created
        cases = db.scalars(select(RecoveryCase).where(RecoveryCase.tenant_id == tenant_id)).all()
        assert len(cases) == 2

        # Verify Audit trail
        audit = db.scalar(
            select(AuditEvent).where(
                AuditEvent.tenant_id == tenant_id,
                AuditEvent.action == "receivables_imported",
            )
        )
        assert audit is not None
        assert audit.actor_uid == user_uid


def test_csv_import_formula_injection_sanitized(test_env):
    client = test_env["client"]
    factory = test_env["session_factory"]

    with factory() as db:
        user = register_user(db, email="importer_sec@test.com", password="Password123!@#", password_confirm="Password123!@#", tenant_name="Sec Org")
        tenant = db.scalar(select(Tenant).where(Tenant.id == user.memberships[0].tenant_id))
        access, _, csrf, _ = issue_session(db, user=user, settings=test_env["settings"])
        tenant_id = tenant.id
        db.commit()

    csv_data = (
        "invoice_number,customer_name,amount,due_date\n"
        "=cmd|'calc'!A0,@Dangerous Corp,100000,2026-08-30\n"
    )

    response = client.post(
        "/api/v1/invoices/import",
        json={"csv_text": csv_data},
        headers={"X-CSRF-Token": csrf, "Authorization": f"Bearer {access}"},
        cookies={"vaada_access": access, "vaada_csrf": csrf},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["imported_count"] == 1

    with factory() as db:
        inv = db.scalar(select(Invoice).where(Invoice.tenant_id == tenant_id))
        assert inv.invoice_number.startswith("'=")

        cust = db.scalar(select(Customer).where(Customer.tenant_id == tenant_id))
        assert cust.display_name.startswith("'@")


def test_duplicate_invoice_detection(test_env):
    client = test_env["client"]
    factory = test_env["session_factory"]

    with factory() as db:
        user = register_user(db, email="importer_dup@test.com", password="Password123!@#", password_confirm="Password123!@#", tenant_name="Dup Org")
        access, _, csrf, _ = issue_session(db, user=user, settings=test_env["settings"])
        db.commit()

    csv_data = (
        "invoice_number,customer_name,amount,due_date\n"
        "INV-DUP-100,Acme Test Ltd,50000,2026-08-30\n"
    )

    # First import
    res1 = client.post(
        "/api/v1/invoices/import",
        json={"csv_text": csv_data},
        headers={"X-CSRF-Token": csrf, "Authorization": f"Bearer {access}"},
        cookies={"vaada_access": access, "vaada_csrf": csrf},
    )
    assert res1.json()["imported_count"] == 1

    # Second import with same invoice number
    res2 = client.post(
        "/api/v1/invoices/import",
        json={"csv_text": csv_data},
        headers={"X-CSRF-Token": csrf, "Authorization": f"Bearer {access}"},
        cookies={"vaada_access": access, "vaada_csrf": csrf},
    )
    assert res2.status_code == 200
    assert res2.json()["duplicate_count"] == 1
    assert res2.json()["imported_count"] == 0


def test_malformed_csv_rows_reported(test_env):
    client = test_env["client"]
    factory = test_env["session_factory"]

    with factory() as db:
        user = register_user(db, email="importer_bad@test.com", password="Password123!@#", password_confirm="Password123!@#", tenant_name="Bad Org")
        access, _, csrf, _ = issue_session(db, user=user, settings=test_env["settings"])
        db.commit()

    bad_csv = (
        "invoice_number,customer_name,amount,due_date\n"
        "INV-BAD-01,Valid Corp,-5000,2026-08-30\n"  # negative amount
        "INV-BAD-02,Valid Corp,10000,not-a-date\n"   # invalid date
        ",Missing Inv Num,10000,2026-08-30\n"        # missing invoice number
    )

    res = client.post(
        "/api/v1/invoices/import",
        json={"csv_text": bad_csv},
        headers={"X-CSRF-Token": csrf, "Authorization": f"Bearer {access}"},
        cookies={"vaada_access": access, "vaada_csrf": csrf},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["imported_count"] == 0
    assert data["error_count"] == 3
    assert any("Row 2" in err and "greater than zero" in err for err in data["errors"])
    assert any("Row 3" in err and "Unrecognized date format" in err for err in data["errors"])
    assert any("Row 4" in err and "Missing required invoice number" in err for err in data["errors"])


def test_download_invoice_template(test_env):
    client = test_env["client"]
    res = client.get("/api/v1/invoices/template.csv")
    assert res.status_code == 200
    assert "invoice_number,customer_name,amount,due_date" in res.text
    assert "text/csv" in res.headers["content-type"]
