# Security

Authentication uses short-lived JWT access cookies and rotating refresh tokens stored as hashes. CSRF double-submit is required on cookie-authenticated mutations. Passwords are hashed with Argon2.

Authorization is role-based (`viewer`, `operator`, `manager`, `admin`) and object-scoped by tenant_id. Case access is never by id alone.

OWASP alignment (selected):

- Broken object-level authorization: tenant predicates on every case/event query.
- Broken authentication: hashed passwords, expiry, refresh rotation, generic login errors.
- Broken function-level authorization: permission map, not UI hiding.
- Unrestricted resource consumption: body size limit, pagination cap, rate limits, LLM timeout/retries.
- SSRF: no user-supplied URL fetch in this version.
- Unsafe consumption of APIs / LLM: schema validation, prompt isolation, no tool-calling.
- Security misconfiguration: restrictive CORS, security headers, no wildcard origins.

Known local-only limitations: in-memory rate limiting, SQLite in tests, seed credentials only when explicitly configured.
