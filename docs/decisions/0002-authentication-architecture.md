# ADR 0002: Multi-Tenant Authentication & Session Security

## Status
Accepted

## Context
Vaada is an enterprise B2B recovery platform handling sensitive merchant invoice data. Authentication and authorization must be multi-tenant by design and immune to client-side token tampering or cross-site scripting (XSS) leaks.

## Decision
We implemented a HTTP-only Cookie + Double-Submit CSRF JWT Session Architecture:
1. **Access Tokens**: Short-lived (15 minutes) signed JWT stored in a `HttpOnly`, `SameSite=Lax` cookie (`vaada_access`).
2. **Refresh Tokens**: Rotating refresh tokens stored as Argon2/SHA256 hashes in the database with 7-day expiration (`vaada_refresh`). Revocable on logout or security events.
3. **Double-Submit CSRF Protection**: Mutating requests (POST, PUT, DELETE) require a matching `X-CSRF-Token` header derived from the `vaada_csrf` cookie.
4. **Tenant Isolation**: Principal authorization is derived strictly on the backend from verified JWT claims and database `Membership` records. Tenant IDs passed by clients are checked against user memberships; unauthenticated or cross-tenant access attempts return HTTP 401/403 errors.

## Consequences
- Tokens are inaccessible to client JavaScript (`HttpOnly`), mitigating XSS token exfiltration risks.
- Every endpoint explicitly enforces tenant boundaries via SQLAlchemy filters (`Invoice.tenant_id == principal.tenant_id`).
