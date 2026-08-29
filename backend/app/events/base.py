from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class NormalizedPaymentEvent:
    source: str
    provider_event_id: str
    event_type: str
    occurred_at: datetime
    failure_code: str | None
    note: str | None
    payload: dict = field(default_factory=dict)
    invoice_number: str | None = None


class EventSource(ABC):
    """Upstream payment events. Case logic must not depend on which source is active."""

    @abstractmethod
    def source_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def pull(self) -> list[NormalizedPaymentEvent]:
        raise NotImplementedError
