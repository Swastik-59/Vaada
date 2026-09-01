---
name: vaada-code-review
description: Senior engineering review skill for Vaada. Use before merging significant changes, after major implementation phases, and whenever requested to review code for correctness, security, architecture, or production readiness.
---

# Vaada Senior Code Review

Review the implementation as if it will be inspected by a senior engineering panel.

Do not review only for syntax.

Check:

## Architecture
- Are responsibilities separated?
- Is business logic in the correct layer?
- Are abstractions justified?
- Is there unnecessary complexity?

## Security
- Authentication
- Authorization
- Tenant isolation
- Object-level authorization
- Input validation
- Rate limiting
- Resource limits
- SQL safety
- Secrets
- CORS
- SSRF
- Webhooks
- LLM security
- Error leakage

## Correctness
- State transitions
- Idempotency
- Concurrency
- Transactions
- Financial calculations
- Duplicate events

## AI
- Structured output validation
- Prompt injection resistance
- Bounded retries
- Failure handling
- Confidence handling
- No uncontrolled LLM authority

## Frontend
- Accessibility
- Loading/error states
- API correctness
- No fake data
- Responsive behavior
- Visual consistency
- Unnecessary client-side trust

## Testing
Identify missing tests rather than assuming behavior works.

## Documentation
Check that important architectural behavior is documented.

## Final classification

For each finding classify:

CRITICAL
HIGH
MEDIUM
LOW
INFO

Do not approve a change with unresolved critical security issues.

Do not recommend cosmetic refactoring while critical correctness or security problems remain.