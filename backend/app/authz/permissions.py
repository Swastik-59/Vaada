from __future__ import annotations

from enum import StrEnum

from app.db.models import Role


class Permission(StrEnum):
    VIEW = "view"
    CREATE = "create"
    EDIT = "edit"
    EXECUTE_ACTION = "execute_action"
    APPROVE = "approve"
    EXPORT = "export"
    MANAGE_USERS = "manage_users"
    MANAGE_INTEGRATIONS = "manage_integrations"
    MANAGE_COMPLIANCE = "manage_compliance"
    VIEW_AUDIT = "view_audit"
    MANAGE_TAXONOMY = "manage_taxonomy"


PERMISSIONS: dict[str, frozenset[str]] = {
    # Canonical actions
    Permission.VIEW.value: frozenset({Role.VIEWER.value, Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    Permission.CREATE.value: frozenset({Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    Permission.EDIT.value: frozenset({Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    Permission.EXECUTE_ACTION.value: frozenset({Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    Permission.APPROVE.value: frozenset({Role.MANAGER.value, Role.ADMIN.value}),
    Permission.EXPORT.value: frozenset({Role.MANAGER.value, Role.ADMIN.value}),
    Permission.VIEW_AUDIT.value: frozenset({Role.MANAGER.value, Role.ADMIN.value}),
    Permission.MANAGE_COMPLIANCE.value: frozenset({Role.MANAGER.value, Role.ADMIN.value}),
    Permission.MANAGE_USERS.value: frozenset({Role.ADMIN.value}),
    Permission.MANAGE_INTEGRATIONS.value: frozenset({Role.ADMIN.value}),
    Permission.MANAGE_TAXONOMY.value: frozenset({Role.ADMIN.value}),

    # Legacy & domain-specific aliases
    "cases:read": frozenset({Role.VIEWER.value, Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    "cases:create": frozenset({Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    "cases:act": frozenset({Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    "cases:override": frozenset({Role.MANAGER.value, Role.ADMIN.value}),
    "events:ingest": frozenset({Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    "audit:read": frozenset({Role.MANAGER.value, Role.ADMIN.value}),
    "metrics:read": frozenset({Role.VIEWER.value, Role.OPERATOR.value, Role.MANAGER.value, Role.ADMIN.value}),
    "admin:users": frozenset({Role.ADMIN.value}),
}


def role_allows(role: str, permission: str) -> bool:
    allowed = PERMISSIONS.get(permission)
    if allowed is None:
        return False
    return role in allowed
