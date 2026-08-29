from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ActorType, AuditEvent


def write_audit(
    db: Session,
    *,
    action: str,
    resource_type: str,
    actor_type: str = ActorType.SYSTEM.value,
    actor_id: str | None = None,
    tenant_id: str | None = None,
    resource_id: str | None = None,
    correlation_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        tenant_id=tenant_id,
        actor_type=actor_type,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        correlation_id=correlation_id,
        payload_json=json.dumps(payload or {}, default=str),
    )
    db.add(event)
    db.flush()
    return event
