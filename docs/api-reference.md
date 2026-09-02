# API Reference Guide

Base URL: `/api/v1`

All mutating endpoints require valid authentication cookies (`vaada_access`) and CSRF double-submit token headers (`X-CSRF-Token`).

---

## 1. Authentication Endpoints

### `POST /api/v1/auth/login`
Authenticates user credentials and issues secure HTTP-only session cookies.
- **Request Body**:
  ```json
  {
    "email": "operator@vaada.local",
    "password": "password12"
  }
  ```
- **Response** (200 OK):
  ```json
  {
    "user_id": "usr_...",
    "email": "operator@vaada.local",
    "memberships": [{"tenant_id": "ten_...", "role": "operator"}]
  }
  ```

### `POST /api/v1/auth/refresh`
Rotates refresh token and extends active access session.

### `POST /api/v1/auth/logout`
Revokes active refresh token and clears auth cookies.

### `GET /api/v1/auth/me`
Returns current authenticated principal user, active tenant ID, and assigned permissions.

---

## 2. Event Ingestion Endpoints

### `POST /api/v1/events`
Ingests a single payment/invoice event into the system pipeline.
- **Request Body**:
  ```json
  {
    "source": "synthetic",
    "provider_event_id": "evt_1001",
    "invoice_id": "inv_...",
    "event_type": "payment.failed",
    "occurred_at": "2026-08-23T21:00:00Z",
    "failure_code": "INSUFFICIENT_FUNDS",
    "note": null,
    "payload": {}
  }
  ```

### `POST /api/v1/events/synthetic`
Triggers batch ingestion of synthetic test events for demo & testing.

### `POST /api/v1/webhooks/razorpay`
HMAC signature-verified webhook listener for Razorpay test mode payment events. Requires `X-Razorpay-Signature` header.

---

## 3. Case Operations & Workflow Endpoints

### `GET /api/v1/cases`
Lists all active recovery cases scoped to the user's tenant.
- **Query Parameters**: `limit` (default 50, max 100), `offset` (default 0).

### `GET /api/v1/cases/{case_id}`
Returns full case details, including decision trace history, extracted promises, compliance evaluation logs, outbound messages, and audit trail.

### `POST /api/v1/cases/{case_id}/actions`
Triggers a recovery action or human override on a case.
- **Request Body**:
  ```json
  {
    "action": "send_reminder", // or "pause" | "escalate" | "mark_recovered" | "cancel"
    "reason": "Operator manually requested outbound contact",
    "expected_version": 1
  }
  ```

### `POST /api/v1/cases/{case_id}/customer-replies`
Simulates or ingests an incoming customer Hinglish message for promise-to-pay extraction and workflow DAG evaluation.
- **Request Body**:
  ```json
  {
    "message": "kal tak 50000 rupees pay kar dunga UPI se pakka",
    "expected_version": 1
  }
  ```

---

## 4. Financial Metrics Endpoint

### `GET /api/v1/metrics`
Returns tenant recovery performance summary:
- `open_cases`
- `recovered_cases`
- `recovered_amount_minor` (in paise/cents)
