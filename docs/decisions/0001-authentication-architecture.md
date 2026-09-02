# Decision: authentication architecture

## Context

The operations console is a first-party browser app that must call a FastAPI backend with credentials.

## Options considered

1. Bearer JWT in localStorage
2. HttpOnly access + refresh cookies with CSRF
3. Opaque server sessions only

## Decision

HttpOnly access JWT cookie (minutes) plus rotating refresh token cookie. CSRF double-submit on mutations.

## Why

It avoids exposing tokens to JavaScript while remaining deployable without a shared session store for access tokens. Refresh tokens remain revocable because only hashes are stored.

## Trade-offs

CSRF handling is required. Cross-site embedding is intentionally difficult.

## Consequences

Frontend must send credentials and CSRF headers. localStorage must not store access tokens.

## Future reconsideration

Move to fully opaque sessions if a shared cache/session store is introduced.
