from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import Uuid


from app.core.identity import generate_user_uid


class Base(DeclarativeBase):
    pass


class UserStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DISABLED = "disabled"
    PENDING_VERIFICATION = "pending_verification"


class VerificationTokenType(StrEnum):
    EMAIL_VERIFICATION = "email_verification"
    PASSWORD_RESET = "password_reset"


class Role(StrEnum):
    VIEWER = "viewer"
    OPERATOR = "operator"
    MANAGER = "manager"
    ADMIN = "admin"


class CaseState(StrEnum):
    OPEN = "open"
    CLASSIFIED = "classified"
    AWAITING_ACTION = "awaiting_action"
    CONTACTED = "contacted"
    AWAITING_RESPONSE = "awaiting_response"
    PROMISE_RECORDED = "promise_recorded"
    HUMAN_REVIEW = "human_review"
    PAUSED = "paused"
    BLOCKED = "blocked"
    RECOVERED = "recovered"
    UNRECOVERABLE = "unrecoverable"
    CANCELLED = "cancelled"


class ClassificationMethod(StrEnum):
    RULE = "RULE"
    LLM = "LLM"


class ActorType(StrEnum):
    USER = "user"
    SYSTEM = "system"
    LLM = "llm"
    DEBTOR = "debtor"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str] = mapped_column(String(200), nullable=False)

    memberships: Mapped[list[Membership]] = relationship(back_populates="tenant")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    uid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True, default=generate_user_uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default=UserStatus.ACTIVE.value, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    password_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    session_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    memberships: Mapped[list[Membership]] = relationship(back_populates="user")
    refresh_tokens: Mapped[list[RefreshToken]] = relationship(back_populates="user")


class Membership(Base, TimestampMixin):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_membership_user_tenant"),)

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)

    user: Mapped[User] = relationship(back_populates="memberships")
    tenant: Mapped[Tenant] = relationship(back_populates="memberships")


class RefreshToken(Base, TimestampMixin):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    session_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    replaced_by_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    user: Mapped[User] = relationship(back_populates="refresh_tokens")


class VerificationToken(Base, TimestampMixin):
    __tablename__ = "verification_tokens"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship()


class NoticeType(StrEnum):
    MSME_43B_H = "msme_43b_h"
    SEC_138_NI_ACT = "sec_138_ni_act"
    MSME_SAMADHAAN_FORM_1 = "msme_samadhaan_form_1"
    STATEMENT_OF_ACCOUNT = "statement_of_account"


class DisputeStatus(StrEnum):
    NONE = "none"
    TDS_DEDUCTED = "tds_deducted"
    GST_MISMATCH = "gst_mismatch"
    SHORT_SUPPLY = "short_supply"
    PRICE_DISPUTE = "price_dispute"


class RiskTier(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("tenant_id", "external_ref", name="uq_customer_tenant_ref"),)

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    external_ref: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_channel: Mapped[str] = mapped_column(String(32), nullable=False)
    contact_value: Mapped[str] = mapped_column(String(320), nullable=False)
    gstin: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pan: Mapped[str | None] = mapped_column(String(10), nullable=True)
    is_msme: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    msme_category: Mapped[str | None] = mapped_column(String(32), nullable=True)
    udyam_reg_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), nullable=True)


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoice_tenant_number"),
        CheckConstraint("amount_minor >= 0", name="ck_invoice_amount_non_negative"),
    )

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="overdue", nullable=False)
    e_invoice_irn: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tds_rate_percent: Mapped[float] = mapped_column(Numeric(4, 2), default=0.0, nullable=False)
    tds_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    net_payable_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    statutory_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_status: Mapped[str] = mapped_column(String(32), default="none", nullable=False)
    dispute_notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class PaymentEvent(Base, TimestampMixin):
    __tablename__ = "payment_events"
    __table_args__ = (UniqueConstraint("source", "provider_event_id", name="uq_event_source_provider_id"),)

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    invoice_id: Mapped[str | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duplicate_of_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class RecoveryCase(Base, TimestampMixin):
    __tablename__ = "recovery_cases"
    __table_args__ = (UniqueConstraint("invoice_id", name="uq_case_invoice"),)

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False)
    source_event_id: Mapped[str] = mapped_column(ForeignKey("payment_events.id"), nullable=False)
    state: Mapped[str] = mapped_column(String(32), default=CaseState.OPEN.value, nullable=False)
    root_cause: Mapped[str | None] = mapped_column(String(64), nullable=True)
    classification_method: Mapped[str | None] = mapped_column(String(8), nullable=True)
    recovery_probability: Mapped[float | None] = mapped_column(Numeric(6, 5), nullable=True)
    contact_attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    statutory_interest_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    p2p_broken_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credit_risk_tier: Mapped[str] = mapped_column(String(16), default="MEDIUM", nullable=False)
    cash_discount_offered_percent: Mapped[float] = mapped_column(Numeric(4, 2), default=0.0, nullable=False)
    last_action_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class CaseTransition(Base, TimestampMixin):
    __tablename__ = "case_transitions"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    from_state: Mapped[str] = mapped_column(String(32), nullable=False)
    to_state: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    score: Mapped[float | None] = mapped_column(Numeric(6, 5), nullable=True)
    action_id: Mapped[str | None] = mapped_column(String(36), nullable=True)


class WorkflowActionRecord(Base, TimestampMixin):
    __tablename__ = "workflow_actions"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class PromiseToPay(Base, TimestampMixin):
    __tablename__ = "promises_to_pay"
    __table_args__ = (CheckConstraint("amount_minor >= 0", name="ck_promise_amount_non_negative"),)

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    promised_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    language_mix: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="recorded", nullable=False)
    extraction_failure: Mapped[str | None] = mapped_column(String(64), nullable=True)
    installment_index: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    total_installments: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    t_minus_1_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_broken: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ComplianceCheck(Base, TimestampMixin):
    __tablename__ = "compliance_checks"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(64), nullable=False)
    decision: Mapped[str] = mapped_column(String(16), nullable=False)
    results_json: Mapped[str] = mapped_column(Text, nullable=False)
    failed_rule_ids: Mapped[str] = mapped_column(Text, default="", nullable=False)


class OutboundCommunication(Base, TimestampMixin):
    __tablename__ = "outbound_communications"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(32), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class AuditEvent(Base, TimestampMixin):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str | None] = mapped_column(ForeignKey("tenants.id"), nullable=True)
    actor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    actor_uid: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)


class StatutoryNotice(Base, TimestampMixin):
    __tablename__ = "statutory_notices"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    notice_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_name: Mapped[str] = mapped_column(String(200), nullable=False)
    recipient_contact: Mapped[str] = mapped_column(String(320), nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    statutory_reference: Mapped[str] = mapped_column(String(128), nullable=False)
    claim_amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    statutory_interest_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cure_period_days: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="generated", nullable=False)


class PaymentReconciliation(Base, TimestampMixin):
    __tablename__ = "payment_reconciliations"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), nullable=False)
    case_id: Mapped[str] = mapped_column(ForeignKey("recovery_cases.id"), nullable=False)
    reconciliation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_number: Mapped[str] = mapped_column(String(128), nullable=False)
    proof_payload_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    reconciled_by: Mapped[str] = mapped_column(String(64), nullable=False)
