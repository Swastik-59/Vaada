---
name: vaada-frontend
description: Next.js and React engineering skill for Vaada's authenticated operations console. Use when creating or modifying pages, components, state, API integration, authentication UX, performance, accessibility, or frontend architecture.
---

# Vaada Frontend Engineering

Use Next.js and React with TypeScript.

Keep components focused and composable.

Do not put business logic into giant page components.

## API

Use a consistent API client layer.

Handle:

- authentication expiry
- authorization failures
- validation errors
- rate limiting
- network failures
- backend failures
- stale state

Never duplicate API logic across components.

## Security

Frontend authorization is only a UX layer.

The backend remains authoritative.

Never trust:

- localStorage role flags
- client-provided tenant IDs
- hidden inputs
- client-only permission checks

Never expose secrets in browser code.

## Data integrity

Authoritative values must come from the backend:

- case status
- recovery amount
- compliance result
- recovery probability
- audit history
- promise status

Never fabricate business metrics in the frontend.

## UI states

Every important feature needs:

- loading
- success
- empty
- error
- unauthorized
- rate-limited
- unavailable

states.

## Accessibility

Maintain:

- keyboard navigation
- focus visibility
- semantic markup
- adequate contrast
- accessible labels
- reduced-motion support

## Performance

Avoid:

- unnecessary requests
- request loops
- unnecessary rerenders
- large client payloads
- unbounded polling

Never add automatic retries to state-changing requests without considering idempotency.