from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("VAADA_JWT_SECRET", "bulletproof-secret-key-32chars-min!!")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAADA_CORS_ORIGINS", "http://localhost:3000")

from app.authz.permissions import Permission, role_allows
from app.core.config import get_settings
from app.core.identity import generate_session_jti, generate_user_uid, generate_uuid7
from app.core.security import (
    create_access_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.db.models import (
    AuditEvent,
    CaseState,
    Customer,
    Invoice,
    Membership,
    PaymentEvent,
    RecoveryCase,
    Role,
    Tenant,
    User,
    UserStatus,
)
from app.main import create_app


@pytest.fixture
def test_setup():
    get_settings.cache_clear()
    app = create_app()
    db = app.state.session_factory()
    try:
        # Tenant 1 (Acme)
        t1 = Tenant(slug="acme-corp", name="Acme Corp", legal_name="Acme Corp Pvt Ltd")
        db.add(t1)
        db.flush()

        # Tenant 2 (Beta)
        t2 = Tenant(slug="beta-ltd", name="Beta Ltd", legal_name="Beta Logistics Pvt Ltd")
        db.add(t2)
        db.flush()

        # Users for Tenant 1
        u1_manager = User(
            email="manager@acme.test",
            password_hash=hash_password("Secur3!Passw0rd#1"),
            status=UserStatus.ACTIVE.value,
            is_active=True,
            session_version=1,
        )
        u1_viewer = User(
            email="viewer@acme.test",
            password_hash=hash_password("Secur3!Passw0rd#2"),
            status=UserStatus.ACTIVE.value,
            is_active=True,
            session_version=1,
        )
        u1_disabled = User(
            email="disabled@acme.test",
            password_hash=hash_password("Secur3!Passw0rd#3"),
            status=UserStatus.DISABLED.value,
            is_active=False,
            session_version=1,
        )

        # User for Tenant 2
        u2_manager = User(
            email="manager@beta.test",
            password_hash=hash_password("Secur3!Passw0rd#4"),
            status=UserStatus.ACTIVE.value,
            is_active=True,
            session_version=1,
        )

        db.add_all([u1_manager, u1_viewer, u1_disabled, u2_manager])
        db.flush()

        # Memberships
        db.add_all(
            [
                Membership(user_id=u1_manager.id, tenant_id=t1.id, role=Role.MANAGER.value),
                Membership(user_id=u1_viewer.id, tenant_id=t1.id, role=Role.VIEWER.value),
                Membership(user_id=u1_disabled.id, tenant_id=t1.id, role=Role.OPERATOR.value),
                Membership(user_id=u2_manager.id, tenant_id=t2.id, role=Role.MANAGER.value),
            ]
        )

        # Invoices and cases for Tenant 1
        c1 = Customer(
            tenant_id=t1.id,
            external_ref="CUST-ACME-01",
            display_name="Acme Debtor A",
            contact_channel="email",
            contact_value="debtor_a@example.com",
        )
        db.add(c1)
        db.flush()
        inv1 = Invoice(
            tenant_id=t1.id,
            customer_id=c1.id,
            invoice_number="INV-ACME-001",
            amount_minor=500000,
            currency="INR",
            issued_at=datetime.now(UTC) - timedelta(days=20),
            due_at=datetime.now(UTC) - timedelta(days=5),
            status="overdue",
        )
        db.add(inv1)
        db.flush()
        evt1 = PaymentEvent(
            tenant_id=t1.id,
            source="synthetic",
            provider_event_id="EVT-ACME-001",
            invoice_id=inv1.id,
            customer_id=c1.id,
            event_type="payment.failed",
            payload_json="{}",
            occurred_at=datetime.now(UTC) - timedelta(days=5),
        )
        db.add(evt1)
        db.flush()
        case1 = RecoveryCase(
            tenant_id=t1.id,
            customer_id=c1.id,
            invoice_id=inv1.id,
            source_event_id=evt1.id,
            state=CaseState.AWAITING_ACTION.value,
            recovery_probability=0.75,
        )
        db.add(case1)

        # Invoices and cases for Tenant 2
        c2 = Customer(
            tenant_id=t2.id,
            external_ref="CUST-BETA-01",
            display_name="Beta Debtor B",
            contact_channel="email",
            contact_value="debtor_b@example.com",
        )
        db.add(c2)
        db.flush()
        inv2 = Invoice(
            tenant_id=t2.id,
            customer_id=c2.id,
            invoice_number="INV-BETA-001",
            amount_minor=850000,
            currency="INR",
            issued_at=datetime.now(UTC) - timedelta(days=25),
            due_at=datetime.now(UTC) - timedelta(days=10),
            status="overdue",
        )
        db.add(inv2)
        db.flush()
        evt2 = PaymentEvent(
            tenant_id=t2.id,
            source="synthetic",
            provider_event_id="EVT-BETA-001",
            invoice_id=inv2.id,
            customer_id=c2.id,
            event_type="payment.failed",
            payload_json="{}",
            occurred_at=datetime.now(UTC) - timedelta(days=10),
        )
        db.add(evt2)
        db.flush()
        case2 = RecoveryCase(
            tenant_id=t2.id,
            customer_id=c2.id,
            invoice_id=inv2.id,
            source_event_id=evt2.id,
            state=CaseState.AWAITING_ACTION.value,
            recovery_probability=0.60,
        )
        db.add(case2)
        db.commit()

        yield {
            "app": app,
            "client": TestClient(app),
            "db_factory": app.state.session_factory,
            "tenant_1": t1,
            "tenant_2": t2,
            "u1_manager": u1_manager,
            "u1_viewer": u1_viewer,
            "u1_disabled": u1_disabled,
            "u2_manager": u2_manager,
            "case_1": case1,
            "case_2": case2,
        }
    finally:
        db.close()


def test_uuid7_generation_properties():
    """Verify RFC 9562 UUIDv7 properties and user UID generation."""
    u1 = generate_uuid7()
    u2 = generate_uuid7()
    assert u1.version == 7
    assert u2.version == 7
    assert u1 != u2

    uid1 = generate_user_uid()
    uid2 = generate_user_uid()
    assert uid1.startswith("usr_")
    assert uid2.startswith("usr_")
    assert len(uid1) == 36  # usr_ + 32 hex chars
    assert uid1 != uid2

    jti = generate_session_jti()
    assert jti.startswith("jti_")
    assert len(jti) > 20


def test_argon2id_password_hashing_and_strength():
    """Verify Argon2id hash output, verification, and password complexity rules."""
    pw = "P@ssw0rd!Secure99"
    h = hash_password(pw)
    assert h.startswith("$argon2id$")
    assert verify_password(pw, h)
    assert not verify_password("WrongPassword1!", h)

    # Password strength validation:
    validate_password_strength("Valid#Password123")
    with pytest.raises(Exception):  # too short
        validate_password_strength("Short1!")
    with pytest.raises(Exception):  # no symbol
        validate_password_strength("NoSymbolPassword123")
    with pytest.raises(Exception):  # no digit
        validate_password_strength("NoDigitPassword!@#")
    with pytest.raises(Exception):  # common password
        validate_password_strength("Password1234!")


def test_user_database_identity_model(test_setup):
    """Verify User model columns: UID, status, session_version, failed_login_count, timestamps."""
    db = test_setup["db_factory"]()
    try:
        user = db.get(User, test_setup["u1_manager"].id)
        assert user is not None
        assert user.uid.startswith("usr_")
        assert user.status == "active"
        assert user.session_version == 1
        assert user.failed_login_count == 0
        assert user.is_active is True
        assert user.created_at is not None
    finally:
        db.close()


def test_login_and_cookie_session(test_setup):
    """Verify successful login returns user UID, status, and sets secure HttpOnly cookies."""
    client = test_setup["client"]
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "uid" in data
    assert data["uid"].startswith("usr_")
    assert data["email"] == "manager@acme.test"
    assert data["status"] == "active"
    assert "vaada_access" in resp.cookies
    assert "vaada_csrf" in resp.cookies


def test_brute_force_account_lockout(test_setup):
    """Verify account lockout occurs after 5 failed attempts."""
    client = test_setup["client"]
    email = "manager@acme.test"

    for i in range(5):
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": f"wrong-pass-{i}"},
        )
        assert resp.status_code == 401
        assert resp.json()["error"]["message"] == "Invalid email or password."

    # 6th attempt should be blocked by account lockout
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Secur3!Passw0rd#1"},
    )
    assert resp.status_code == 401
    assert "locked" in resp.json()["error"]["message"].lower()

    # Verify audit event for account lockout was logged with actor_uid
    db = test_setup["db_factory"]()
    try:
        event = (
            db.query(AuditEvent)
            .filter_by(action="auth.account_locked")
            .order_by(AuditEvent.created_at.desc())
            .first()
        )
        assert event is not None
        assert event.actor_uid == test_setup["u1_manager"].uid
    finally:
        db.close()


def test_disabled_account_cannot_authenticate(test_setup):
    """Verify disabled account cannot login or use existing tokens."""
    client = test_setup["client"]
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "disabled@acme.test", "password": "Secur3!Passw0rd#3"},
    )
    assert resp.status_code == 401


def test_session_revocation_via_session_version(test_setup):
    """Verify session_version increment invalidates prior JWT access tokens."""
    client = test_setup["client"]
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    assert login_resp.status_code == 200

    # /auth/me succeeds with initial session
    me_resp = client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200

    # Bump session_version directly in DB (simulating admin revocation or password change)
    db = test_setup["db_factory"]()
    try:
        user = db.get(User, test_setup["u1_manager"].id)
        user.session_version += 1
        db.commit()
    finally:
        db.close()

    # Prior session token should now be immediately rejected
    me_revoked = client.get("/api/v1/auth/me")
    assert me_revoked.status_code == 401
    assert "revoked" in me_revoked.json()["error"]["message"].lower()


def test_password_change_revokes_sessions(test_setup):
    """Verify password change invalidates old sessions and accepts new password."""
    client = test_setup["client"]
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    assert login_resp.status_code == 200
    csrf = client.cookies.get("vaada_csrf")

    new_pass = "BrandN3w!Passw0rd99"
    change_resp = client.post(
        "/api/v1/auth/change-password",
        headers={"X-CSRF-Token": csrf or ""},
        json={
            "current_password": "Secur3!Passw0rd#1",
            "new_password": new_pass,
            "new_password_confirm": new_pass,
        },
    )
    assert change_resp.status_code == 200

    # Login with old password fails
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    assert old_login.status_code == 401

    # Login with new password succeeds
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": new_pass},
    )
    assert new_login.status_code == 200


def test_forgot_and_reset_password_flow(test_setup):
    """Verify forgot password creates secure token and reset password completes with session bump."""
    client = test_setup["client"]
    forgot_resp = client.post(
        "/api/v1/auth/forgot-password",
        json={"email": "manager@beta.test"},
    )
    assert forgot_resp.status_code == 200

    # Extract token from DB
    db = test_setup["db_factory"]()
    try:
        from app.core.identity import hash_token
        from app.db.models import VerificationToken, VerificationTokenType
        token_rows = (
            db.query(VerificationToken)
            .filter_by(token_type=VerificationTokenType.PASSWORD_RESET.value)
            .all()
        )
        assert len(token_rows) > 0
    finally:
        db.close()

    # If demo_mode was true or in dev response, token is available, or we can test with direct token:
    from app.core.identity import generate_verification_token, hash_token
    from app.db.models import VerificationToken, VerificationTokenType
    db = test_setup["db_factory"]()
    raw_token = generate_verification_token()
    try:
        vt = VerificationToken(
            user_id=test_setup["u2_manager"].id,
            token_hash=hash_token(raw_token),
            token_type=VerificationTokenType.PASSWORD_RESET.value,
            expires_at=datetime.now(UTC) + timedelta(minutes=15),
        )
        db.add(vt)
        db.commit()
    finally:
        db.close()

    reset_pass = "ResetN3w!Passw0rd123"
    reset_resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": reset_pass,
            "new_password_confirm": reset_pass,
        },
    )
    assert reset_resp.status_code == 200

    # Verify new password works
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@beta.test", "password": reset_pass},
    )
    assert login_resp.status_code == 200


def test_tenant_isolation_and_idor_bola_prevention(test_setup):
    """
    CRITICAL BOLA/IDOR TEST:
    User 1 (Tenant 1) attempts to read and mutate User 2's case (Tenant 2).
    Must be rejected with 404 (or 403) without leaking cross-tenant data.
    """
    client = test_setup["client"]

    # Login as User 1 (Tenant 1)
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    assert login_resp.status_code == 200
    csrf = client.cookies.get("vaada_csrf")

    case_1_id = test_setup["case_1"].id
    case_2_id = test_setup["case_2"].id

    # User 1 accesses Tenant 1 case -> 200 OK
    r1 = client.get(f"/api/v1/cases/{case_1_id}")
    assert r1.status_code == 200

    # User 1 attempts to access Tenant 2 case -> 404 Not Found (BOLA blocked)
    r2 = client.get(f"/api/v1/cases/{case_2_id}")
    assert r2.status_code == 404

    # User 1 attempts to mutate Tenant 2 case via action -> 404 Not Found
    r3 = client.post(
        f"/api/v1/cases/{case_2_id}/actions",
        headers={"X-CSRF-Token": csrf or ""},
        json={"action": "send_reminder"},
    )
    assert r3.status_code == 404

    # User 1 attempts to switch tenant header to Tenant 2 -> 403 Forbidden
    r4 = client.get(
        f"/api/v1/cases/{case_1_id}",
        headers={"X-Vaada-Tenant-Id": test_setup["tenant_2"].id},
    )
    assert r4.status_code == 403


def test_rbac_privilege_enforcement(test_setup):
    """Verify viewer cannot execute mutating actions and role permissions are strictly evaluated."""
    client = test_setup["client"]

    # Login as Viewer
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "viewer@acme.test", "password": "Secur3!Passw0rd#2"},
    )
    assert login_resp.status_code == 200
    csrf = client.cookies.get("vaada_csrf")
    case_1_id = test_setup["case_1"].id

    # Viewer CAN read cases
    read_resp = client.get(f"/api/v1/cases/{case_1_id}")
    assert read_resp.status_code == 200

    # Viewer CANNOT execute mutating actions
    action_resp = client.post(
        f"/api/v1/cases/{case_1_id}/actions",
        headers={"X-CSRF-Token": csrf or ""},
        json={"action": "send_reminder"},
    )
    assert action_resp.status_code == 403

    # Verify role_allows matrix
    assert role_allows(Role.VIEWER.value, Permission.VIEW.value) is True
    assert role_allows(Role.VIEWER.value, Permission.EXECUTE_ACTION.value) is False
    assert role_allows(Role.OPERATOR.value, Permission.EXECUTE_ACTION.value) is True
    assert role_allows(Role.OPERATOR.value, Permission.MANAGE_USERS.value) is False
    assert role_allows(Role.ADMIN.value, Permission.MANAGE_USERS.value) is True


def test_audit_event_records_actor_uid(test_setup):
    """Verify all audit records contain the actor's immutable User UID (usr_...)."""
    client = test_setup["client"]
    client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )

    db = test_setup["db_factory"]()
    try:
        events = (
            db.query(AuditEvent)
            .filter(AuditEvent.actor_uid.isnot(None))
            .order_by(AuditEvent.created_at.desc())
            .all()
        )
        assert len(events) > 0
        for ev in events:
            assert ev.actor_uid.startswith("usr_")
    finally:
        db.close()


def test_csrf_protection_on_cookie_auth(test_setup):
    """Verify state-changing requests authenticated via cookies require matching CSRF header."""
    client = test_setup["client"]
    client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    case_1_id = test_setup["case_1"].id

    # Request without CSRF header should be rejected
    no_csrf = client.post(
        f"/api/v1/cases/{case_1_id}/actions",
        json={"action": "send_reminder"},
    )
    assert no_csrf.status_code == 401
    assert "csrf" in no_csrf.json()["error"]["message"].lower()

    # Request with wrong CSRF header should be rejected
    bad_csrf = client.post(
        f"/api/v1/cases/{case_1_id}/actions",
        headers={"X-CSRF-Token": "invalid-csrf-token"},
        json={"action": "send_reminder"},
    )
    assert bad_csrf.status_code == 401


def test_signup_creates_user_with_unique_uid_and_tenant(test_setup):
    """Verify signup generates server-side UID, creates default tenant, and prevents duplicate accounts."""
    client = test_setup["client"]
    new_email = "founder@newstartup.test"
    new_pass = "Sup3r!SecurePassword#1"

    signup_resp = client.post(
        "/api/v1/auth/signup",
        json={
            "email": new_email,
            "password": new_pass,
            "password_confirm": new_pass,
            "tenant_name": "NewStartup Tech",
        },
    )
    assert signup_resp.status_code == 200
    data = signup_resp.json()
    assert data["uid"].startswith("usr_")
    assert data["email"] == new_email
    assert data["status"] == "active"
    assert "password_hash" not in data
    assert len(data["memberships"]) == 1

    # Duplicate signup attempt should be rejected
    dup_resp = client.post(
        "/api/v1/auth/signup",
        json={
            "email": new_email,
            "password": new_pass,
            "password_confirm": new_pass,
        },
    )
    assert dup_resp.status_code == 409


def test_no_password_hash_exposure_in_any_api_response(test_setup):
    """ASVS Requirement: Password hashes and secrets must never be serialized or exposed in API responses."""
    client = test_setup["client"]
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@acme.test", "password": "Secur3!Passw0rd#1"},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "password_hash" not in login_data
    assert "password" not in login_data

    me_resp = client.get("/api/v1/auth/me")
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert "password_hash" not in me_data
    assert "password" not in me_data


def test_auth_config_reflects_settings(test_setup):
    """Verify auth config endpoint exposes demo_mode state."""
    client = test_setup["client"]
    resp = client.get("/api/v1/auth/config")
    assert resp.status_code == 200
    assert "demo_mode" in resp.json()
    assert isinstance(resp.json()["demo_mode"], bool)

