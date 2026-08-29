# Vaayda

Vaayda is a bounded B2B revenue-recovery system for Indian merchants. It classifies overdue payment events, scores recovery likelihood with a classical model, extracts promise-to-pay commitments from customer language, and executes only those actions that pass deterministic compliance and authorization checks.

The LLM never authorizes an action, never changes case state by itself, and never bypasses compliance.

## What this repository contains now

- A FastAPI modular monolith with authentication, tenant isolation, case workflow, compliance, audit, and synthetic event ingestion.
- A Next.js public site plus an operations console for queue, case detail, decision trace, compliance, and human override.
- Tests for authentication failure, classification, extraction validation, scoring bounds, and illegal workflow jumps.
- Architecture and security documentation.

Razorpay live integration is intentionally not implemented. The event source is an interface plus a synthetic/demo ingest path.

## Local setup

1. Copy `.env.example` to the **repository root** `.env` (not `backend/.env`) and replace every secret placeholder, including `VAAYDA_JWT_SECRET` and `VAAYDA_SEED_ADMIN_PASSWORD`.
2. Optional Postgres: `docker compose up -d postgres`. Local default is SQLite at `backend/vaayda.db`.
3. Create a virtualenv, install `backend/requirements.txt`, then from `backend/`:

```bash
uvicorn app.main:app --reload
python -m app.seed
```

4. Run the frontend with `npm install` and `npm run dev` in `frontend/`.
5. Open `http://localhost:3000` for the public site. Sign-in is `http://localhost:3000/login`. The live queue is `/queue` after authentication.

The homepage is a marketing surface. It does not invent recovered rupees. Operational numbers come from the API after login.

## How to log in (local / demo)

Putting values in `.env` does not create an account. The operator user exists only after `python -m app.seed`.

1. Keep the API running (`uvicorn` on port 8000).
2. Keep the console running (`npm run dev` on port 3000).
3. Open `http://localhost:3000/login`.
4. Email: `VAAYDA_SEED_ADMIN_EMAIL` from `.env` (default `operator@vaayda.local`).
5. Password: `VAAYDA_SEED_ADMIN_PASSWORD` from the repository-root `.env`. After changing it, run `python -m app.seed` again.

Seed also creates `viewer@vaayda.local` with the same local password. Do not use these credentials outside local development.

## Tests

```bash
cd backend
pytest -q
```
