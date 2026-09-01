---
name: vaada-testing
description: Testing and adversarial QA skill for Vaada. Use when implementing features, fixing bugs, hardening security, validating workflows, or preparing a release.
---

# Vaada Testing

Do not test only happy paths.

Every feature should be tested at the appropriate level:

- unit
- service
- integration
- API
- end-to-end
- security

## Always consider

- malformed input
- missing input
- invalid state
- unauthorized access
- cross-tenant access
- duplicate requests
- duplicate events
- race conditions
- external dependency failures
- timeouts
- malformed LLM output
- prompt injection
- rate-limit exhaustion
- oversized payloads

## Security tests

Explicitly test:

- broken object-level authorization
- privilege escalation
- authentication failures
- cross-tenant access
- unrestricted pagination
- expensive endpoint abuse
- SQL injection attempts
- prompt injection
- disclosure violations
- compliance bypass attempts

## Workflow tests

Test:

- valid transitions
- invalid transitions
- repeated transitions
- concurrent transitions
- blocked actions
- human override
- recovery completion
- failed recovery

## LLM tests

Use deliberately difficult inputs:

- malformed JSON expectations
- Hinglish
- ambiguous dates
- missing amounts
- contradictory statements
- prompt injection
- unusually long input

Never replace real validation with snapshot tests that merely encode an incorrect response.

## Regression rule

Every bug fixed should receive a regression test when practical.

A fix without a test is an invitation for the bug to return wearing a different shirt.