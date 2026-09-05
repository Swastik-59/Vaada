# Deployment Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Vaada's existing Next.js frontend and FastAPI backend deployable as a stateless Vercel + Render service pair without changing the backend-owned authentication model.

**Architecture:** The browser continues calling `/api/v1/*` on the Vercel origin; Next.js proxies those calls to a validated `VAADA_API_ORIGIN` deployment variable instead of localhost. FastAPI consumes a Render/Postgres URL, exposes independent liveness and readiness probes, and does not create or mutate schemas at startup. Render runs a non-root, single-process Uvicorn container and delegates persistence to Postgres.

**Tech Stack:** Next.js 15.1.6, React 19, FastAPI 0.115.6, SQLAlchemy 2, Alembic, PostgreSQL 16, Docker, Render Blueprint.

**Spec:** `C:/Users/User/.codex/attachments/90d941d9-5dd0-4a2c-8e4d-36a551a8eed7/pasted-text.txt`

## Global Constraints

- Preserve backend-issued HttpOnly cookie sessions and CSRF validation.
- Do not expose secrets through `NEXT_PUBLIC_*` variables.
- Do not include production credentials in tracked files.
- Render Free services are stateless and can spin down; do not add an in-process scheduler or filesystem persistence.
- Do not change the declared Next.js, React, or FastAPI versions in this phase.

---

### Task 1: Environment-driven frontend API routing

**Files:**
- Modify: `frontend/next.config.ts`
- Modify: `.env.example`
- Test: `frontend/next.config.test.mjs`

**Interfaces:**
- Consumes: `VAADA_API_ORIGIN`, an absolute `http` or `https` URL with no trailing path.
- Produces: rewrite destination `${VAADA_API_ORIGIN}/api/v1/:path*`.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(resolveApiOrigin({ VAADA_API_ORIGIN: 'https://api.vaada.example' }), 'https://api.vaada.example');
assert.throws(() => resolveApiOrigin({ VAADA_API_ORIGIN: 'not-a-url' }));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test next.config.test.mjs`

- [ ] **Step 3: Implement the resolver and rewrite**

```ts
const apiOrigin = new URL(process.env.VAADA_API_ORIGIN ?? 'http://127.0.0.1:8000').origin;
destination: `${apiOrigin}/api/v1/:path*`;
```

- [ ] **Step 4: Run focused test and production build**

Run: `node --test next.config.test.mjs && npm run build`

### Task 2: Explicit database lifecycle and probes

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/db/session.py`
- Modify: `backend/app/core/config.py`
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Produces: `GET /health` with no database access and `GET /ready` that reports 503 when its database check fails.
- Removes: application-startup `Base.metadata.create_all()` and SQLite schema-altering production behavior.

- [ ] **Step 1: Write failing health tests**

```python
def test_health_is_live_without_database() -> None:
    assert client.get('/health').status_code == 200

def test_ready_reports_dependency_failure(monkeypatch) -> None:
    monkeypatch.setattr(session, 'database_is_ready', lambda _: False)
    assert client.get('/ready').status_code == 503
```

- [ ] **Step 2: Verify failing behavior**

Run: `python -m pytest tests/test_health.py -q`

- [ ] **Step 3: Implement bounded readiness**

```python
@app.get('/ready')
def ready() -> JSONResponse:
    if not database_is_ready(app.state.engine):
        return JSONResponse(status_code=503, content={'status': 'unavailable'})
    return JSONResponse(content={'status': 'ready'})
```

- [ ] **Step 4: Validate it**

Run: `python -m pytest tests/test_health.py -q && python -m pytest -q`

### Task 3: Migration and container deployment assets

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`
- Create: `render.yaml`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Render invokes `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Health check targets `/health`; readiness is an operational diagnostic endpoint.

- [ ] **Step 1: Add a Docker build smoke check**

Run: `docker build -t vaada-backend-smoke backend`

- [ ] **Step 2: Create non-root production image**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN useradd --create-home appuser
USER appuser
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

- [ ] **Step 3: Add a Blueprint with the database URL and secret variables marked sync:false**

```yaml
services:
  - type: web
    env: docker
    dockerfilePath: ./backend/Dockerfile
    healthCheckPath: /health
```

- [ ] **Step 4: Re-run image smoke test**

Run: `docker build -t vaada-backend-smoke backend`

### Task 4: Deployment documentation and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/known-limitations.md`

**Interfaces:**
- Documents exact Render and Vercel variables without values.
- Documents that free Render web services can cold-start and that free databases expire after 30 days.

- [ ] **Step 1: Document local and deployment variables**

```text
Render: VAADA_DATABASE_URL, VAADA_JWT_SECRET, VAADA_CORS_ORIGINS, VAADA_COOKIE_SECURE=true
Vercel: VAADA_API_ORIGIN=https://<render-service>.onrender.com
```

- [ ] **Step 2: Verify tracked files contain no values from `.env`**

Run: `git grep -nE 'VAADA_(JWT_SECRET|RAZORPAY_KEY_SECRET)=.{16,}' -- ':!.env.example'`

- [ ] **Step 3: Verify repository gates**

Run: `python -m pytest -q` in `backend`; `npm run build` in `frontend`; `git diff --check` at repository root.
