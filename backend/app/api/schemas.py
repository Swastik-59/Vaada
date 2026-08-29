from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)


class EventIngestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source: str = Field(min_length=2, max_length=64)
    provider_event_id: str = Field(min_length=3, max_length=128)
    invoice_id: str
    event_type: str = Field(min_length=2, max_length=64)
    occurred_at: datetime
    failure_code: str | None = Field(default=None, max_length=64)
    note: str | None = Field(default=None, max_length=4000)
    payload: dict = Field(default_factory=dict)


class CaseActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: str = Field(min_length=3, max_length=64)
    reason: str | None = Field(default=None, max_length=500)
    expected_version: int | None = None
    idempotency_key: str | None = Field(default=None, max_length=128)


class SyntheticBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    count: int = Field(default=1, ge=1, le=20)


class CustomerReplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=4000)
    expected_version: int | None = None


class StatutoryNoticeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notice_type: str = Field(min_length=3, max_length=32)


class TDSReconcileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    tds_rate_percent: float = Field(ge=0.0, le=30.0)
    form_16a_ack: str = Field(min_length=3, max_length=128)


class PaymentReconcileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount_minor: int = Field(gt=0)
    reconciliation_type: str = Field(default="bank_utr", max_length=32)
    reference_number: str = Field(min_length=3, max_length=128)


class CashDiscountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    discount_percent: float = Field(ge=0.0, le=15.0)


