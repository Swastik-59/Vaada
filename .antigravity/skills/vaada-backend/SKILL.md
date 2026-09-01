---
name: vaada-backend
description: Backend architecture skill for Vaada using FastAPI, Pydantic, SQLAlchemy, PostgreSQL, domain services, workflow orchestration, event processing, and transactional business logic.
---

# Vaada Backend Engineering

Build the backend as a modular monolith with clear domain boundaries.

Prefer explicit, boring architecture over clever abstractions.

## Architecture

Keep responsibilities separated:

- API routes
- schemas
- services
- domain logic
- persistence
- authentication
- authorization
- compliance
- orchestration
- LLM integration
- event ingestion
- audit
- observability

Routes should orchestrate requests, not contain complex business logic.

## Validation

All external data must enter through typed schemas.

Validate:

- types
- ranges
- lengths
- enums
- timestamps
- monetary values
- nested structures
- IDs
- optional fields

Never pass arbitrary request dictionaries deep into the application.

## Database

Use SQLAlchemy and migrations.

Never construct SQL using string interpolation.

Use:

- constraints
- foreign keys
- indexes
- unique constraints
- transactions

where appropriate.

Database invariants should be enforced by the database whenever practical.

## State transitions

Case states must be explicit.

Never allow arbitrary client-provided state transitions.

Before changing state:

- verify current state
- verify allowed transition
- verify authorization
- verify compliance
- perform the change transactionally
- create the corresponding audit event

## Event processing

Assume events can be:

- duplicated
- delayed
- reordered
- retried
- malformed

Design ingestion to be idempotent.

Do not execute financial/recovery actions twice because an event was delivered twice.

## LLM integration

All LLM calls must go through the central LLMClient abstraction.

Do not call Ollama directly from business modules.

Implement:

- timeouts
- bounded retries
- structured output validation
- explicit failure states
- logging
- model configuration

## Errors

Use explicit domain/application errors.

Do not leak:

- stack traces
- database errors
- internal paths
- secrets
- implementation details

into API responses.

## Testing

Every domain service should have tests.

Important areas require:

- happy-path tests
- invalid-input tests
- authorization tests
- concurrency/idempotency tests
- failure-path tests