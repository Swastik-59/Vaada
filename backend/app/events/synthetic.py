from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import Invoice
from app.events.base import EventSource, NormalizedPaymentEvent

CODES = ("INSUFFICIENT_FUNDS", "MANDATE_FAILED", "BANK_DECLINE", "NETWORK_ERROR")


class SyntheticEventSource(EventSource):
    def __init__(self, invoices: list[Invoice], *, count: int = 1) -> None:
        self.invoices = invoices
        self.count = count

    def source_name(self) -> str:
        return "synthetic"

    def pull(self) -> list[NormalizedPaymentEvent]:
        events: list[NormalizedPaymentEvent] = []
        if not self.invoices:
            return events
        for index in range(self.count):
            invoice = self.invoices[index % len(self.invoices)]
            code = CODES[index % len(CODES)]
            events.append(
                NormalizedPaymentEvent(
                    source="synthetic",
                    provider_event_id=f"SYN-{uuid4().hex[:12]}",
                    event_type="payment.failed",
                    occurred_at=datetime.now(UTC),
                    failure_code=code,
                    note=None,
                    payload={"generator": "SyntheticEventSource", "failure_code": code},
                    invoice_number=invoice.invoice_number,
                )
            )
        return events
