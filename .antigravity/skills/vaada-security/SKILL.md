---
name: vaada-security
description: Security engineering and threat-modeling skill for Vaada. Use whenever implementing, reviewing, modifying, or debugging authentication, authorization, APIs, database access, tenant isolation, webhooks, rate limiting, LLM functionality, integrations, secrets, or any state-changing operation.
---

# Vaada Security Engineering

Treat every external input as untrusted.

Security must be enforced server-side. Never rely on frontend checks for authorization.

## Mandatory review areas

For every security-sensitive change, inspect:

- Authentication
- Authorization
- Object-level authorization
- Function-level authorization
- Tenant isolation
- Input validation
- Output filtering
- SQL injection
- Mass assignment
- Rate limiting
- Resource exhaustion
- Idempotency
- Race conditions
- CSRF where applicable
- CORS
- Security headers
- SSRF
- Webhook verification
- Secrets management
- Dependency vulnerabilities
- Error leakage
- Audit logging
- LLM prompt injection
- LLM output validation
- Privilege escalation

## Authentication

Never:
- hardcode credentials
- store plaintext passwords
- expose password hashes
- trust client-provided identity
- use permanent tokens
- log tokens or passwords

Use the project's chosen authentication architecture consistently.

## Authorization

Every state-changing endpoint must verify:

1. authenticated identity
2. required permission
3. tenant membership
4. ownership/resource access
5. whether the requested action is valid for the current resource state

Never trust tenant IDs, roles, user IDs, or permissions supplied by the frontend.

## Multi-tenancy

Every tenant-owned resource must be scoped to the authenticated tenant.

Never fetch an object by ID without applying authorization/tenant constraints.

Test cross-tenant access explicitly.

## Rate limiting

Protect all public endpoints.

Use stricter controls for:

- authentication
- token operations
- LLM endpoints
- expensive searches
- bulk operations
- event ingestion
- workflow execution

Also enforce payload-size, pagination, batch-size, and concurrency limits.

## LLM security

Customer text is untrusted data.

Never allow customer text to override system instructions.

The LLM must never directly control:

- authorization
- compliance bypass
- payment execution
- SQL
- HTTP requests
- arbitrary code
- unrestricted workflow transitions

Every LLM output must pass:

1. schema validation
2. semantic validation
3. business-rule validation
4. authorization
5. compliance validation

Malformed or suspicious output must fail safely.

## Security testing

Whenever a security-sensitive feature is implemented, add tests for both:

- expected successful behavior
- malicious/abusive behavior

Do not declare security work complete because the code "looks secure".

Run the appropriate tests and inspect the actual implementation.