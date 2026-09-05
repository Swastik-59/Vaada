from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

import json
from app.api.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.api.schemas import (
    CaseActionRequest,
    CashDiscountRequest,
    ChangePasswordRequest,
    CustomerReplyRequest,
    EventIngestRequest,
    ForgotPasswordRequest,
    JobTriggerRequest,
    LoginRequest,
    PaymentReconcileRequest,
    RazorpayLookupRequest,
    RazorpaySimulatorRequest,
    ResetPasswordRequest,
    SignupRequest,
    StatutoryNoticeRequest,
    SyntheticBatchRequest,
    TDSReconcileRequest,
    TenantSampleDataRequest,
)
from app.services.sample_data import clear_tenant_sample_data, generate_tenant_sample_data
from app.services.jobs import (
    run_promise_adherence_check,
    run_stale_case_monitor,
    run_compliance_window_sweeper,
    run_analytics_aggregation,
)
from app.services.analytics import get_portfolio_analytics
from app.services.razorpay_webhook import handle_razorpay_webhook
from app.events.razorpay import generate_razorpay_signature, verify_razorpay_signature

from app.authz.deps import Principal, current_principal, get_db, require_permission
from app.authz.permissions import role_allows
from app.core.config import Settings, get_settings
from app.core.errors import AuthorizationFailed, DependencyFailed, NotFound, ValidationFailed
from app.services.language import LanguageDetector
from app.services.razorpay import (
    derive_recovery_policy,
    evaluate_combined_case_decision,
    get_taxonomy_service,
    normalize_razorpay_error,
)
from app.db.models import (
    AuditEvent,
    CaseState,
    CaseTransition,
    ComplianceCheck,
    Customer,
    DisputeStatus,
    Invoice,
    NoticeType,
    OutboundCommunication,
    PaymentEvent,
    PaymentReconciliation,
    PromiseToPay,
    RecoveryCase,
    RiskTier,
    StatutoryNotice,
    Tenant,
    User,
    WorkflowActionRecord,
)
from app.events.razorpay import RazorpayTestModeSource, verify_razorpay_signature
from app.events.synthetic import SyntheticEventSource
from app.llm.client import LLMClient
from app.services.auth import (
    authenticate,
    change_user_password,
    complete_password_reset,
    issue_session,
    register_user,
    request_password_reset,
    revoke_refresh,
    rotate_refresh,
)
from app.services.cases import (
    apply_cash_discount,
    apply_human_override,
    get_tenant_case,
    ingest_customer_reply,
    issue_statutory_notice,
    reconcile_tds,
    record_payment_reconciliation,
    request_outbound_contact,
)
from app.services.channels import compose_whatsapp_interactive_payload, generate_dynamic_upi_payload
from app.services.ingestion import ingest_payment_event
from app.services.p2p import evaluate_case_p2p_adherence
from app.services.portal import generate_portal_token
from app.services.statutory import get_43b_h_status

router = APIRouter()


@router.get("/auth/config")
def auth_config(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "demo_mode": settings.demo_mode,
    }


@router.post("/auth/signup")
def signup(
    body: SignupRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    user = register_user(
        db,
        email=body.email,
        password=body.password,
        password_confirm=body.password_confirm,
        tenant_name=body.tenant_name,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    access, refresh, csrf, expires = issue_session(db, user=user, settings=settings)
    set_auth_cookies(
        response,
        access_token=access,
        refresh_token=refresh,
        csrf_token=csrf,
        refresh_expires=expires,
        settings=settings,
    )
    memberships = list(user.memberships)
    return {
        "user_id": user.id,
        "uid": user.uid,
        "email": user.email,
        "status": user.status,
        "memberships": [
            {"tenant_id": item.tenant_id, "role": item.role}
            for item in memberships
        ],
    }


@router.post("/auth/login")
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    user = authenticate(
        db,
        email=body.email,
        password=body.password,
        settings=settings,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    access, refresh, csrf, expires = issue_session(db, user=user, settings=settings)
    set_auth_cookies(response, access_token=access, refresh_token=refresh, csrf_token=csrf, refresh_expires=expires, settings=settings)
    memberships = list(user.memberships)
    return {
        "user_id": user.id,
        "uid": user.uid,
        "email": user.email,
        "status": user.status,
        "memberships": [
            {"tenant_id": item.tenant_id, "role": item.role}
            for item in memberships
        ],
    }


@router.post("/auth/refresh")
def refresh_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    token = request.cookies.get(REFRESH_COOKIE)
    user, access, refresh_token, csrf, expires = rotate_refresh(db, refresh_token=token or "", settings=settings)
    set_auth_cookies(response, access_token=access, refresh_token=refresh_token, csrf_token=csrf, refresh_expires=expires, settings=settings)
    return {"user_id": user.id, "uid": user.uid}


@router.post("/auth/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    raw_token = request_password_reset(
        db,
        email=body.email,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    resp = {
        "message": "If an account associated with this email exists, password reset instructions have been dispatched."
    }
    if settings.demo_mode and raw_token:
        resp["dev_reset_token"] = raw_token
    return resp


@router.post("/auth/reset-password")
def reset_password(
    body: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    user = complete_password_reset(
        db,
        token=body.token,
        new_password=body.new_password,
        new_password_confirm=body.new_password_confirm,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    return {
        "message": "Password successfully updated. All prior sessions have been revoked.",
        "uid": user.uid,
    }


@router.post("/auth/change-password")
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    principal: Principal = Depends(current_principal),
    settings: Settings = Depends(get_settings),
) -> dict:
    change_user_password(
        db,
        user=principal.user,
        current_password=body.current_password,
        new_password=body.new_password,
        new_password_confirm=body.new_password_confirm,
        correlation_id=principal.correlation_id or getattr(request.state, "correlation_id", None),
    )
    access, refresh, csrf, expires = issue_session(db, user=principal.user, settings=settings)
    set_auth_cookies(
        response,
        access_token=access,
        refresh_token=refresh,
        csrf_token=csrf,
        refresh_expires=expires,
        settings=settings,
    )
    return {
        "message": "Password successfully updated. All other active sessions have been invalidated.",
        "uid": principal.user_uid,
    }


@router.post("/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> dict:
    user_id = None
    user_uid = None
    try:
        principal = current_principal(request, db, get_settings())
        user_id = principal.user.id
        user_uid = principal.user_uid
    except Exception:
        user_id = None
        user_uid = None
    revoke_refresh(
        db,
        refresh_token=request.cookies.get(REFRESH_COOKIE),
        user_id=user_id,
        user_uid=user_uid,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    clear_auth_cookies(response)
    return {"status": "logged_out"}


@router.get("/auth/me")
def me(principal: Principal = Depends(current_principal), db: Session = Depends(get_db)) -> dict:
    tenant = db.get(Tenant, principal.tenant_id)
    return {
        "user_id": principal.user.id,
        "uid": principal.user.uid,
        "email": principal.user.email,
        "status": principal.user.status,
        "tenant_id": principal.tenant_id,
        "tenant_name": tenant.name if tenant else principal.tenant_id,
        "role": principal.role,
        "created_at": principal.user.created_at.isoformat() if principal.user.created_at else None,
        "last_login_at": principal.user.last_login_at.isoformat() if principal.user.last_login_at else None,
    }


@router.post("/tenant/sample-data")
def generate_sample_data(
    body: TenantSampleDataRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:create")),
    settings: Settings = Depends(get_settings),
) -> dict:
    if settings.env == "production" and not settings.demo_mode:
        raise AuthorizationFailed("Sample data generation is disabled in production environments.")

    tenant = db.get(Tenant, principal.tenant_id)
    if not tenant:
        raise NotFound("Tenant not found.")

    return generate_tenant_sample_data(
        db,
        tenant=tenant,
        actor_uid=principal.user_uid,
        scenario=body.scenario,
        count=body.count,
    )


@router.delete("/tenant/sample-data")
def reset_sample_data(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:create")),
    settings: Settings = Depends(get_settings),
) -> dict:
    if settings.env == "production" and not settings.demo_mode:
        raise AuthorizationFailed("Sample data operations are disabled in production environments.")

    tenant = db.get(Tenant, principal.tenant_id)
    if not tenant:
        raise NotFound("Tenant not found.")

    return clear_tenant_sample_data(
        db,
        tenant=tenant,
        actor_uid=principal.user_uid,
    )


@router.post("/events")
def ingest_event(
    body: EventIngestRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("events:ingest")),
) -> dict:
    tenant = db.get(Tenant, principal.tenant_id)
    invoice = db.get(Invoice, body.invoice_id)
    if tenant is None or invoice is None or invoice.tenant_id != principal.tenant_id:
        raise NotFound("Invoice not found.")
    event, case, duplicate = ingest_payment_event(
        db,
        tenant=tenant,
        source=body.source,
        provider_event_id=body.provider_event_id,
        invoice=invoice,
        event_type=body.event_type,
        payload=body.payload,
        occurred_at=body.occurred_at,
        failure_code=body.failure_code,
        note=body.note,
        correlation_id=principal.correlation_id or getattr(request.state, "correlation_id", None),
    )
    return {
        "event_id": event.id,
        "case_id": case.id if case else None,
        "duplicate": duplicate,
        "case_state": case.state if case else None,
    }


@router.get("/invoices")
def list_invoices(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    rows = db.execute(
        select(Invoice).where(Invoice.tenant_id == principal.tenant_id).order_by(Invoice.due_at.desc())
    ).scalars().all()
    return {
        "items": [
            {
                "id": item.id,
                "invoice_number": item.invoice_number,
                "amount_minor": item.amount_minor,
                "currency": item.currency,
                "due_at": item.due_at.isoformat() if item.due_at else None,
                "status": item.status,
            }
            for item in rows
        ]
    }


@router.post("/events/synthetic")
def ingest_synthetic_batch(
    body: SyntheticBatchRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("events:ingest")),
) -> dict:
    tenant = db.get(Tenant, principal.tenant_id)
    invoices = db.execute(select(Invoice).where(Invoice.tenant_id == principal.tenant_id)).scalars().all()
    if tenant is None or not invoices:
        raise NotFound("No invoices available to attach synthetic events.")
    source = SyntheticEventSource(list(invoices), count=body.count)
    created: list[dict] = []
    for event in source.pull():
        invoice = next((item for item in invoices if item.invoice_number == event.invoice_number), invoices[0])
        record, case, duplicate = ingest_payment_event(
            db,
            tenant=tenant,
            source=event.source,
            provider_event_id=event.provider_event_id,
            invoice=invoice,
            event_type=event.event_type,
            payload=event.payload,
            occurred_at=event.occurred_at,
            failure_code=event.failure_code,
            note=event.note,
            correlation_id=principal.correlation_id or getattr(request.state, "correlation_id", None),
        )
        created.append(
            {
                "event_id": record.id,
                "case_id": case.id if case else None,
                "duplicate": duplicate,
                "invoice_number": invoice.invoice_number,
                "failure_code": event.failure_code,
            }
        )
    return {"source": source.source_name(), "items": created}


@router.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    secret = settings.razorpay_webhook_secret or "vaada_rzp_test_secret_2026"
    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    return handle_razorpay_webhook(
        db,
        raw_body=body,
        signature=signature,
        secret=secret,
        correlation_id=getattr(request.state, "correlation_id", None),
    )


@router.post("/webhooks/simulator")
def simulate_razorpay_webhook(
    body: RazorpaySimulatorRequest,
    request: Request,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("events:ingest")),
    settings: Settings = Depends(get_settings),
) -> dict:
    """
    Operator and Evaluator Tool:
    Generates authentic Razorpay Test Mode webhook payloads, computes HMAC-SHA256 signature,
    and runs them through the full closed-loop event processing pipeline.
    """
    if settings.env == "production" and not settings.demo_mode:
        raise AuthorizationFailed("Gateway simulator is disabled in production environments.")

    tenant = db.get(Tenant, principal.tenant_id)
    if not tenant:
        raise NotFound("Tenant not found.")

    invoice: Invoice | None = None
    if body.invoice_number:
        invoice = db.scalar(
            select(Invoice).where(
                Invoice.tenant_id == principal.tenant_id,
                Invoice.invoice_number == body.invoice_number,
            )
        )
    if not invoice:
        # Pick the most relevant invoice
        if body.scenario == "payment_successful":
            # Pick an invoice that has an active case
            active_case = db.scalar(
                select(RecoveryCase)
                .where(RecoveryCase.tenant_id == principal.tenant_id, RecoveryCase.state != CaseState.RECOVERED.value)
                .order_by(RecoveryCase.created_at.desc())
            )
            if active_case:
                invoice = db.get(Invoice, active_case.invoice_id)
        if not invoice:
            invoice = db.scalar(
                select(Invoice)
                .where(Invoice.tenant_id == principal.tenant_id)
                .order_by(Invoice.due_at.asc())
            )

    if not invoice:
        raise NotFound("No invoice available for simulation in this tenant.")

    amount_minor = body.amount_minor or invoice.net_payable_minor or invoice.amount_minor
    now_ts = int(datetime.now(UTC).timestamp())
    rand_suffix = datetime.now(UTC).strftime("%H%M%S")

    if body.custom_payload:
        simulated_payload = body.custom_payload
    elif body.scenario == "payment_successful":
        simulated_payload = {
            "entity": "event",
            "account_id": "acc_vaada_test",
            "event": "payment.captured",
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_sim_{rand_suffix}",
                        "entity": "payment",
                        "amount": amount_minor,
                        "currency": "INR",
                        "status": "captured",
                        "method": "upi",
                        "description": f"Settlement for {invoice.invoice_number}",
                        "notes": {
                            "invoice_number": invoice.invoice_number,
                            "tenant_id": tenant.id,
                        },
                        "acquirer_data": {
                            "bank_transaction_id": f"UTR{now_ts}",
                        },
                        "created_at": now_ts,
                    }
                }
            },
            "created_at": now_ts,
        }
    elif body.scenario == "bank_technical_error":
        simulated_payload = {
            "entity": "event",
            "account_id": "acc_vaada_test",
            "event": "payment.failed",
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_sim_{rand_suffix}",
                        "entity": "payment",
                        "amount": amount_minor,
                        "currency": "INR",
                        "status": "failed",
                        "method": "netbanking",
                        "description": f"Settlement for {invoice.invoice_number}",
                        "notes": {
                            "invoice_number": invoice.invoice_number,
                            "tenant_id": tenant.id,
                        },
                        "error_code": "GATEWAY_ERROR",
                        "error_description": "The acquiring bank core banking switch timed out.",
                        "error_source": "gateway",
                        "error_step": "payment_authorization",
                        "error_reason": "payment_failed",
                        "created_at": now_ts,
                    }
                }
            },
            "created_at": now_ts,
        }
    elif body.scenario == "partial_payment":
        half_amount = max(amount_minor // 2, 100)
        simulated_payload = {
            "entity": "event",
            "account_id": "acc_vaada_test",
            "event": "payment.captured",
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_sim_{rand_suffix}",
                        "entity": "payment",
                        "amount": half_amount,
                        "currency": "INR",
                        "status": "captured",
                        "method": "card",
                        "description": f"Partial settlement for {invoice.invoice_number}",
                        "notes": {
                            "invoice_number": invoice.invoice_number,
                            "tenant_id": tenant.id,
                        },
                        "acquirer_data": {
                            "bank_transaction_id": f"UTR_PART_{now_ts}",
                        },
                        "created_at": now_ts,
                    }
                }
            },
            "created_at": now_ts,
        }
    else:  # insufficient_funds
        simulated_payload = {
            "entity": "event",
            "account_id": "acc_vaada_test",
            "event": "payment.failed",
            "contains": ["payment"],
            "payload": {
                "payment": {
                    "entity": {
                        "id": f"pay_sim_{rand_suffix}",
                        "entity": "payment",
                        "amount": amount_minor,
                        "currency": "INR",
                        "status": "failed",
                        "method": "upi",
                        "description": f"Debit failed for {invoice.invoice_number}",
                        "notes": {
                            "invoice_number": invoice.invoice_number,
                            "tenant_id": tenant.id,
                        },
                        "error_code": "BAD_REQUEST_ERROR",
                        "error_description": "Payment was declined by customer's bank due to insufficient funds.",
                        "error_source": "customer",
                        "error_step": "payment_authentication",
                        "error_reason": "insufficient_funds",
                        "created_at": now_ts,
                    }
                }
            },
            "created_at": now_ts,
        }

    raw_body = json.dumps(simulated_payload).encode("utf-8")
    secret = settings.razorpay_webhook_secret or "vaada_rzp_test_secret_2026"
    sig = generate_razorpay_signature(body=raw_body, secret=secret)

    result = handle_razorpay_webhook(
        db,
        raw_body=raw_body,
        signature=sig,
        secret=secret,
        tenant_override=tenant,
        correlation_id=principal.correlation_id or getattr(request.state, "correlation_id", None),
    )
    result["simulated_scenario"] = body.scenario
    result["simulated_invoice"] = invoice.invoice_number
    return result



@router.get("/event-source")
def event_source_status(
    principal: Principal = Depends(require_permission("events:ingest")),
    settings: Settings = Depends(get_settings),
) -> dict:
    if settings.event_source == "razorpay_test":
        adapter = RazorpayTestModeSource(key_id=settings.razorpay_key_id, key_secret=settings.razorpay_key_secret)
        return {"active": adapter.source_name(), "pull_ready": bool(settings.razorpay_key_id and settings.razorpay_key_secret)}
    return {"active": "synthetic", "pull_ready": True}


@router.get("/razorpay/taxonomy")
def list_razorpay_taxonomy(
    payment_method: str | None = None,
    source: str | None = None,
    step: str | None = None,
    category: str | None = None,
    code: str | None = None,
    reason: str | None = None,
    recoverability: str | None = None,
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    """Lists official Razorpay published taxonomy errors enriched with derived Vaada recovery logic."""
    taxonomy_svc = get_taxonomy_service()
    entries = taxonomy_svc.get_all(
        payment_method=payment_method,
        source=source,
        step=step,
        category=category,
        code=code,
        reason=reason,
    )
    items = []
    for entry in entries:
        derived = derive_recovery_policy(entry)
        if recoverability and derived.get("recoverability") != recoverability.lower().strip():
            continue
        items.append({
            "id": entry.id,
            "official": entry.to_dict(),
            "derived": derived,
        })
    return {
        "metadata": taxonomy_svc.get_metadata(),
        "total": len(items),
        "items": items,
    }


@router.get("/razorpay/taxonomy/{entry_id}")
def get_razorpay_taxonomy_entry(
    entry_id: str,
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    """Fetches a specific official Razorpay taxonomy entry by ID."""
    taxonomy_svc = get_taxonomy_service()
    entry = taxonomy_svc.get_by_id(entry_id)
    if not entry:
        raise NotFound("Razorpay taxonomy entry not found.")
    return {
        "official": entry.to_dict(),
        "derived": derive_recovery_policy(entry),
    }


@router.post("/razorpay/lookup")
def lookup_razorpay_error(
    body: RazorpayLookupRequest,
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    """Deterministic lookup of a raw or structured error against official Razorpay taxonomy."""
    raw = body.raw_payload or {
        "code": body.code,
        "reason": body.reason,
        "source": body.source,
        "step": body.step,
        "payment_method": body.payment_method,
    }
    normalized = normalize_razorpay_error(
        raw,
        payment_method=body.payment_method,
        failure_code=body.code,
    )
    return normalized


@router.get("/cases")
def list_cases(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:read")),
    settings: Settings = Depends(get_settings),
    limit: int = 50,
    offset: int = 0,
) -> dict:
    limit = min(max(limit, 1), settings.pagination_max_limit)
    offset = max(offset, 0)
    rows = db.execute(
        select(RecoveryCase)
        .where(RecoveryCase.tenant_id == principal.tenant_id)
        .order_by(RecoveryCase.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()
    return {
        "items": [_case_summary(db, item) for item in rows],
        "limit": limit,
        "offset": offset,
        "metrics": _tenant_metrics(db, principal.tenant_id),
    }


@router.get("/cases/{case_id}")
def get_case(
    case_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    return _case_detail(db, get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id))


@router.post("/cases/{case_id}/portal-link")
def create_portal_link(
    case_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    token = generate_portal_token(
        case_id=case.id,
        invoice_id=case.invoice_id,
        tenant_id=case.tenant_id,
        expires_in_days=14,
    )
    return {
        "token": token,
        "portal_url": f"/portal/{token}",
        "expires_in_days": 14,
    }


@router.post("/cases/{case_id}/actions")
def case_action(
    case_id: str,
    body: CaseActionRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
    settings: Settings = Depends(get_settings),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    tenant = db.get(Tenant, principal.tenant_id)
    if tenant is None:
        raise NotFound("Tenant not found.")
    if body.action == "send_reminder":
        result = request_outbound_contact(
            db,
            case=case,
            tenant=tenant,
            actor_id=principal.user.id,
            correlation_id=principal.correlation_id,
            settings=settings,
            expected_version=body.expected_version,
            idempotency_key=body.idempotency_key,
        )
        return {"case": _case_detail(db, case), "result": result}
    override_actions = {"pause", "resume", "escalate", "mark_recovered", "mark_unrecoverable", "cancel"}
    if body.action in override_actions:
        if not role_allows(principal.role, "cases:override"):
            raise AuthorizationFailed("Insufficient permissions.")
        apply_human_override(
            db,
            case=case,
            action=body.action,
            reason=body.reason or "",
            actor_id=principal.user.id,
            correlation_id=principal.correlation_id,
            expected_version=body.expected_version,
        )
        return {"case": _case_detail(db, case), "result": {"status": "executed"}}
    raise ValidationFailed("Unknown action.")


@router.post("/cases/{case_id}/customer-replies")
def customer_reply(
    case_id: str,
    body: CustomerReplyRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
    settings: Settings = Depends(get_settings),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    result = ingest_customer_reply(
        db,
        case=case,
        message=body.message,
        actor_id=principal.user.id,
        correlation_id=principal.correlation_id,
        llm=LLMClient(settings),
        expected_version=body.expected_version,
    )
    return {"case": _case_detail(db, case), "result": result}


@router.post("/cases/{case_id}/notices/generate")
def generate_notice(
    case_id: str,
    body: StatutoryNoticeRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    tenant = db.get(Tenant, principal.tenant_id)
    if tenant is None:
        raise NotFound("Tenant not found.")
    notice = issue_statutory_notice(
        db,
        case=case,
        tenant=tenant,
        notice_type=body.notice_type,
        actor_id=principal.user.id,
        correlation_id=principal.correlation_id,
    )
    return {"case": _case_detail(db, case), "notice": {
        "id": notice.id,
        "notice_type": notice.notice_type,
        "title": notice.title,
        "statutory_reference": notice.statutory_reference,
        "claim_amount_minor": notice.claim_amount_minor,
        "statutory_interest_minor": notice.statutory_interest_minor,
        "content_markdown": notice.content_markdown,
        "created_at": notice.created_at.isoformat() if notice.created_at else None,
    }}


@router.post("/cases/{case_id}/reconciliation/tds")
def reconcile_tds_endpoint(
    case_id: str,
    body: TDSReconcileRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    result = reconcile_tds(
        db,
        case=case,
        tds_rate_percent=body.tds_rate_percent,
        form_16a_ack=body.form_16a_ack,
        actor_id=principal.user.id,
        correlation_id=principal.correlation_id,
    )
    return {"case": _case_detail(db, case), "reconciliation": result}


@router.post("/cases/{case_id}/reconciliation/payment")
def reconcile_payment_endpoint(
    case_id: str,
    body: PaymentReconcileRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    result = record_payment_reconciliation(
        db,
        case=case,
        amount_minor=body.amount_minor,
        reconciliation_type=body.reconciliation_type,
        reference_number=body.reference_number,
        actor_id=principal.user.id,
        correlation_id=principal.correlation_id,
    )
    return {"case": _case_detail(db, case), "payment": result}


@router.post("/cases/{case_id}/discount")
def cash_discount_endpoint(
    case_id: str,
    body: CashDiscountRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    result = apply_cash_discount(
        db,
        case=case,
        discount_percent=body.discount_percent,
        actor_id=principal.user.id,
        correlation_id=principal.correlation_id,
    )
    return {"case": _case_detail(db, case), "discount": result}


@router.post("/cases/{case_id}/p2p/check-adherence")
def check_p2p_adherence_endpoint(
    case_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    result = evaluate_case_p2p_adherence(db, case=case, now=datetime.now(UTC))
    return {"case": _case_detail(db, case), "adherence": result}


@router.post("/jobs/trigger")
def trigger_jobs_endpoint(
    body: JobTriggerRequest,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:act")),
) -> dict:
    results = {}
    if body.job_name in {"promise_adherence", "all"}:
        results["promise_adherence"] = run_promise_adherence_check(db, tenant_id=principal.tenant_id)
    if body.job_name in {"stale_cases", "all"}:
        results["stale_cases"] = run_stale_case_monitor(db, tenant_id=principal.tenant_id, stale_days=body.stale_days)
    if body.job_name in {"compliance_sweeper", "all"}:
        results["compliance_sweeper"] = run_compliance_window_sweeper(db, tenant_id=principal.tenant_id)
    if body.job_name in {"analytics", "all"}:
        results["analytics"] = run_analytics_aggregation(db, tenant_id=principal.tenant_id)

    return {
        "success": True,
        "triggered_job": body.job_name,
        "results": results,
    }


@router.get("/cases/{case_id}/payment-link")
def get_payment_link(
    case_id: str,
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:read")),
) -> dict:
    case = get_tenant_case(db, tenant_id=principal.tenant_id, case_id=case_id)
    tenant = db.get(Tenant, principal.tenant_id)
    invoice = db.get(Invoice, case.invoice_id)
    if not tenant or not invoice:
        raise NotFound("Tenant or invoice not found.")
    return generate_dynamic_upi_payload(tenant, invoice, case)


@router.get("/statutory/portfolio-risk")
def statutory_portfolio_risk(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("metrics:read")),
) -> dict:
    cases = db.execute(select(RecoveryCase).where(RecoveryCase.tenant_id == principal.tenant_id)).scalars().all()
    total_statutory_interest = 0
    total_tax_exposure = 0
    msme_at_risk_count = 0
    disallowed_count = 0

    for case in cases:
        invoice = db.get(Invoice, case.invoice_id)
        customer = db.get(Customer, case.customer_id)
        if invoice and customer:
            stat = get_43b_h_status(invoice, customer)
            total_statutory_interest += stat["statutory_interest_minor"]
            if stat["is_msme"]:
                if stat["is_disallowed"]:
                    disallowed_count += 1
                    total_tax_exposure += stat["tax_disallowance_exposure_minor"]
                elif stat["days_remaining"] <= 10:
                    msme_at_risk_count += 1
                    total_tax_exposure += stat["tax_disallowance_exposure_minor"]

    return {
        "msme_cases_at_risk": msme_at_risk_count,
        "msme_cases_disallowed": disallowed_count,
        "total_statutory_interest_minor": total_statutory_interest,
        "total_tax_disallowance_exposure_minor": total_tax_exposure,
    }


@router.get("/metrics")
def metrics(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("metrics:read")),
) -> dict:
    legacy = _tenant_metrics(db, principal.tenant_id)
    detailed = get_portfolio_analytics(db, principal.tenant_id)
    return {
        **legacy,
        **detailed,
    }


@router.get("/audit")
def list_audit(
    db: Session = Depends(get_db),
    principal: Principal = Depends(require_permission("cases:read")),
    limit: int = 100,
    offset: int = 0,
    action_prefix: str = "",
) -> dict:
    limit = min(max(limit, 1), 500)
    offset = max(offset, 0)
    query = select(AuditEvent).where(AuditEvent.tenant_id == principal.tenant_id)
    if action_prefix:
        query = query.where(AuditEvent.action.like(f"{action_prefix}%"))
    query = query.order_by(AuditEvent.created_at.desc()).limit(limit).offset(offset)
    rows = db.execute(query).scalars().all()
    return {
        "items": [
            {
                "id": item.id,
                "action": item.action,
                "actor_type": item.actor_type,
                "actor_id": item.actor_id,
                "resource_type": item.resource_type,
                "resource_id": item.resource_id,
                "correlation_id": item.correlation_id,
                "payload_json": item.payload_json,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in rows
        ],
        "limit": limit,
        "offset": offset,
    }


@router.get("/settings/compliance")
def compliance_settings(
    principal: Principal = Depends(require_permission("cases:read")),
    settings: Settings = Depends(get_settings),
) -> dict:
    return {
        "contact_window_start_hour": settings.contact_window_start_hour,
        "contact_window_end_hour": settings.contact_window_end_hour,
        "max_contacts_per_7_days": settings.max_contacts_per_7_days,
        "timezone": "Asia/Kolkata",
        "rules": [
            {
                "id": "contact_window",
                "title": "Contact window",
                "description": f"Outbound contact permitted {settings.contact_window_start_hour:02d}:00–{settings.contact_window_end_hour:02d}:00 IST, Monday–Saturday.",
                "enforced": True,
            },
            {
                "id": "frequency_limit",
                "title": "Rolling frequency cap",
                "description": f"Maximum {settings.max_contacts_per_7_days} contacts per case in any 7-day rolling window.",
                "enforced": True,
            },
            {
                "id": "tone_guardrail",
                "title": "Tone guardrail",
                "description": "Outbound message must not contain prohibited coercive or threatening language.",
                "enforced": True,
            },
            {
                "id": "disclosure_guard",
                "title": "Disclosure guard",
                "description": "Message must not disclose debt details to a third party.",
                "enforced": True,
            },
            {
                "id": "identity_requirement",
                "title": "Identity requirement",
                "description": "Every outbound message must identify the sending organisation by its legal name.",
                "enforced": True,
            },
        ],
    }


def _tenant_metrics(db: Session, tenant_id: str) -> dict:
    cases = db.execute(select(RecoveryCase).where(RecoveryCase.tenant_id == tenant_id)).scalars().all()
    recovered = [item for item in cases if item.state == "recovered"]
    amount = 0
    total_statutory_interest = 0
    msme_at_risk_count = 0
    
    for case in cases:
        total_statutory_interest += case.statutory_interest_minor
        invoice = db.get(Invoice, case.invoice_id)
        customer = db.get(Customer, case.customer_id)
        if invoice and case.state == "recovered":
            amount += invoice.amount_minor
        if invoice and customer and case.state not in {"recovered", "unrecoverable", "cancelled"}:
            stat = get_43b_h_status(invoice, customer)
            if stat["is_msme"] and stat["days_remaining"] <= 10:
                msme_at_risk_count += 1

    return {
        "open_cases": len([item for item in cases if item.state not in {"recovered", "unrecoverable", "cancelled"}]),
        "recovered_cases": len(recovered),
        "recovered_amount_minor": amount,
        "statutory_interest_minor": total_statutory_interest,
        "msme_43b_h_at_risk_cases": msme_at_risk_count,
    }


def _case_summary(db: Session, case: RecoveryCase) -> dict:
    invoice = db.get(Invoice, case.invoice_id)
    customer = db.get(Customer, case.customer_id) if case.customer_id else (db.get(Customer, invoice.customer_id) if invoice else None)
    
    statutory_info = get_43b_h_status(invoice, customer) if (invoice and customer) else None

    return {
        "id": case.id,
        "state": case.state,
        "root_cause": case.root_cause,
        "classification_method": case.classification_method,
        "recovery_probability": float(case.recovery_probability) if case.recovery_probability is not None else None,
        "contact_attempt_count": case.contact_attempt_count,
        "version": case.version,
        "invoice_number": invoice.invoice_number if invoice else None,
        "amount_minor": invoice.amount_minor if invoice else None,
        "net_payable_minor": invoice.net_payable_minor if (invoice and invoice.net_payable_minor > 0) else (invoice.amount_minor if invoice else None),
        "currency": invoice.currency if invoice else None,
        "due_at": invoice.due_at.isoformat() if (invoice and invoice.due_at) else None,
        "updated_at": case.updated_at.isoformat() if case.updated_at else None,
        "customer_name": customer.display_name if customer else None,
        "customer_gstin": customer.gstin if customer else None,
        "customer_is_msme": customer.is_msme if customer else False,
        "customer_msme_category": customer.msme_category if customer else None,
        "statutory_interest_minor": statutory_info["statutory_interest_minor"] if statutory_info else case.statutory_interest_minor,
        "p2p_broken_count": case.p2p_broken_count,
        "credit_risk_tier": case.credit_risk_tier,
        "statutory_status": statutory_info,
    }


def _case_detail(db: Session, case: RecoveryCase) -> dict:
    tenant = db.get(Tenant, case.tenant_id)
    invoice = db.get(Invoice, case.invoice_id)
    customer = db.get(Customer, case.customer_id) if case.customer_id else (db.get(Customer, invoice.customer_id) if invoice else None)

    transitions = db.execute(select(CaseTransition).where(CaseTransition.case_id == case.id).order_by(CaseTransition.created_at)).scalars().all()
    actions = db.execute(select(WorkflowActionRecord).where(WorkflowActionRecord.case_id == case.id).order_by(WorkflowActionRecord.created_at)).scalars().all()
    checks = db.execute(select(ComplianceCheck).where(ComplianceCheck.case_id == case.id).order_by(ComplianceCheck.created_at.desc())).scalars().all()
    promises = db.execute(select(PromiseToPay).where(PromiseToPay.case_id == case.id).order_by(PromiseToPay.created_at)).scalars().all()
    messages = db.execute(select(OutboundCommunication).where(OutboundCommunication.case_id == case.id).order_by(OutboundCommunication.created_at)).scalars().all()
    audit = db.execute(select(AuditEvent).where(AuditEvent.resource_id == case.id).order_by(AuditEvent.created_at.desc())).scalars().all()
    notices = db.execute(select(StatutoryNotice).where(StatutoryNotice.case_id == case.id).order_by(StatutoryNotice.created_at.desc())).scalars().all()
    reconciliations = db.execute(select(PaymentReconciliation).where(PaymentReconciliation.case_id == case.id).order_by(PaymentReconciliation.created_at.desc())).scalars().all()

    source_event = db.get(PaymentEvent, case.source_event_id) if case.source_event_id else None

    raw_event_payload = {}
    if source_event and source_event.payload_json:
        try:
            raw_event_payload = json.loads(source_event.payload_json)
        except Exception:
            raw_event_payload = {}

    method = raw_event_payload.get("payment_method") or (
        raw_event_payload.get("error", {}).get("payment_method") if isinstance(raw_event_payload.get("error"), dict) else None
    )

    norm = normalize_razorpay_error(
        raw_event_payload,
        payment_method=method,
        failure_code=case.root_cause,
    )

    latest_promise = promises[-1] if promises else None
    promise_dict = {
        "promised_date": latest_promise.promised_date.isoformat() if latest_promise else None,
        "confidence": float(latest_promise.confidence) if latest_promise else 0.0,
    } if latest_promise else None

    statutory_info = get_43b_h_status(invoice, customer) if (invoice and customer) else None
    days_rem = statutory_info.get("days_remaining") if statutory_info else None
    latest_comm = messages[-1].body if messages else (promises[-1].raw_text if promises else None)

    language_analysis = None
    if latest_comm:
        det = LanguageDetector.detect(latest_comm)
        language_analysis = {
            "raw_text": latest_comm,
            "language": det.language,
            "hindi_ratio": det.hindi_ratio,
            "english_ratio": det.english_ratio,
            "code_switched": det.code_switched,
            "confidence": det.confidence,
            "hindi_signals": det.hindi_signals,
            "english_signals": det.english_signals,
            "intent": "promise_to_pay" if latest_promise else "no_commitment",
            "commitment_strength": "high" if (latest_promise and float(latest_promise.confidence) >= 0.90) else "medium",
        }

    taxonomy_entry = None
    if norm["matched"] and norm["official"]:
        taxonomy_svc = get_taxonomy_service()
        taxonomy_entry = taxonomy_svc.get_by_id(norm["official"]["id"])

    combined_eval = evaluate_combined_case_decision(
        taxonomy_entry=taxonomy_entry,
        raw_payload=raw_event_payload,
        customer_message=latest_comm,
        promise_to_pay=promise_dict,
        broken_p2p_count=case.p2p_broken_count,
        statutory_days_remaining=days_rem,
    )

    official_data = norm["official"]
    raw_info = norm["raw"]
    payment_diagnosis = {
        "matched": norm["matched"],
        "provider": "razorpay",
        "code": official_data["code"] if official_data else (raw_info["code"] or "UNKNOWN_ERROR"),
        "reason": official_data["reason"] if official_data else (raw_info["reason"] or case.root_cause or "unmapped"),
        "source": official_data["source"] if official_data else (raw_info["source"] or "customer"),
        "step": official_data["step"] if official_data else (raw_info["step"] or "payment_initiation"),
        "payment_method": official_data["payment_method"] if official_data else method,
        "description": official_data["description"] if official_data else "Unmapped Razorpay error payload. No official published record found.",
        "official_next_step": official_data["official_next_step"] if official_data else "Flagged for manual operator review; verify raw gateway response.",
        "official_source_url": official_data["official_source_url"] if official_data else "https://razorpay.com/docs/errors/",
        "raw_payload": raw_info,
    }

    recovery_interpretation = {
        "recoverability": combined_eval["recoverability"],
        "retryable": combined_eval["retryable"],
        "urgency": combined_eval["urgency"],
        "customer_action": norm["derived"].get("recommended_customer_action"),
        "merchant_action": combined_eval["recommended_action"],
        "policy_decision": combined_eval["final_policy"],
        "requires_human_review": combined_eval["requires_human_review"],
        "confidence": combined_eval["confidence"],
        "is_unmapped": not norm["matched"],
    }

    upi_info = generate_dynamic_upi_payload(tenant, invoice, case) if (tenant and invoice) else None
    whatsapp_info = compose_whatsapp_interactive_payload(tenant, customer, invoice, case) if (tenant and customer and invoice) else None

    portal_token = generate_portal_token(
        case_id=case.id,
        invoice_id=case.invoice_id,
        tenant_id=case.tenant_id,
        expires_in_days=14,
    )

    return {
        **_case_summary(db, case),
        "portal_access": {
            "token": portal_token,
            "url": f"/portal/{portal_token}",
            "expires_in_days": 14,
        },
        "payment_diagnosis": payment_diagnosis,
        "recovery_interpretation": recovery_interpretation,
        "decision_chain": combined_eval["decision_trace_chain"],
        "language_analysis": language_analysis,
        "customer": {
            "id": customer.id if customer else None,
            "display_name": customer.display_name if customer else "Unknown",
            "contact_channel": customer.contact_channel if customer else "email",
            "contact_value": customer.contact_value if customer else "",
            "phone_number": customer.phone_number if customer else None,
            "gstin": customer.gstin if customer else None,
            "pan": customer.pan if customer else None,
            "is_msme": customer.is_msme if customer else False,
            "msme_category": customer.msme_category if customer else None,
            "udyam_reg_number": customer.udyam_reg_number if customer else None,
        } if customer else None,
        "invoice": {
            "id": invoice.id if invoice else None,
            "invoice_number": invoice.invoice_number if invoice else None,
            "amount_minor": invoice.amount_minor if invoice else None,
            "tds_minor": invoice.tds_minor if invoice else 0,
            "tds_rate_percent": float(invoice.tds_rate_percent) if (invoice and invoice.tds_rate_percent) else 0.0,
            "net_payable_minor": invoice.net_payable_minor if invoice else (invoice.amount_minor if invoice else None),
            "e_invoice_irn": invoice.e_invoice_irn if invoice else None,
            "dispute_status": invoice.dispute_status if invoice else "none",
            "issued_at": invoice.issued_at.isoformat() if (invoice and invoice.issued_at) else None,
            "due_at": invoice.due_at.isoformat() if (invoice and invoice.due_at) else None,
            "status": invoice.status if invoice else "overdue",
        } if invoice else None,
        "upi_payload": upi_info,
        "whatsapp_payload": whatsapp_info,
        "notices": [
            {
                "id": item.id,
                "notice_type": item.notice_type,
                "title": item.title,
                "statutory_reference": item.statutory_reference,
                "claim_amount_minor": item.claim_amount_minor,
                "statutory_interest_minor": item.statutory_interest_minor,
                "cure_period_days": item.cure_period_days,
                "content_markdown": item.content_markdown,
                "status": item.status,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in notices
        ],
        "reconciliations": [
            {
                "id": item.id,
                "reconciliation_type": item.reconciliation_type,
                "amount_minor": item.amount_minor,
                "reference_number": item.reference_number,
                "reconciled_by": item.reconciled_by,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in reconciliations
        ],
        "event": {
            "id": source_event.id if source_event else None,
            "source": source_event.source if source_event else None,
            "provider_event_id": source_event.provider_event_id if source_event else None,
            "event_type": source_event.event_type if source_event else None,
            "occurred_at": source_event.occurred_at.isoformat() if source_event else None,
            "payload_json": source_event.payload_json if source_event else None,
        } if source_event else None,
        "decision_trace": [
            {
                "from_state": item.from_state,
                "to_state": item.to_state,
                "reason": item.reason,
                "actor_type": item.actor_type,
                "score": float(item.score) if item.score is not None else None,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in transitions
        ],
        "actions": [
            {
                "action_type": item.action_type,
                "status": item.status,
                "reason": item.reason,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in actions
        ],
        "compliance": [
            {
                "action_type": item.action_type,
                "decision": item.decision,
                "failed_rule_ids": item.failed_rule_ids,
                "results_json": item.results_json,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in checks
        ],
        "promises": [
            {
                "amount_minor": item.amount_minor,
                "promised_date": item.promised_date.isoformat(),
                "confidence": float(item.confidence),
                "status": item.status,
                "extraction_failure": item.extraction_failure,
                "raw_text": item.raw_text,
                "language_mix": item.language_mix,
                "t_minus_1_sent": item.t_minus_1_sent,
                "is_broken": item.is_broken,
            }
            for item in promises
        ],
        "communications": [
            {
                "channel": item.channel,
                "body": item.body,
                "blocked": item.blocked,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in messages
        ],
        "audit": [
            {
                "action": item.action,
                "actor_type": item.actor_type,
                "actor_id": item.actor_id,
                "payload_json": item.payload_json,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in audit
        ],
    }
