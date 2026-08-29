from __future__ import annotations

from app.db.models import Role

PERMISSIONS: dict[str, frozenset[str]] = {
    "cases:read": frozenset({Role.VIEWER, Role.OPERATOR, Role.MANAGER, Role.ADMIN}),
    "cases:act": frozenset({Role.OPERATOR, Role.MANAGER, Role.ADMIN}),
    "cases:override": frozenset({Role.MANAGER, Role.ADMIN}),
    "events:ingest": frozenset({Role.OPERATOR, Role.MANAGER, Role.ADMIN}),
    "audit:read": frozenset({Role.MANAGER, Role.ADMIN}),
    "metrics:read": frozenset({Role.VIEWER, Role.OPERATOR, Role.MANAGER, Role.ADMIN}),
    "admin:users": frozenset({Role.ADMIN}),
}


def role_allows(role: str, permission: str) -> bool:
    allowed = PERMISSIONS.get(permission)
    if allowed is None:
        return False
    return role in allowed
