# Vaada (वादा)
### Bounded, Compliant B2B Revenue-Recovery System for Indian Enterprises

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.1+-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![SQLite / PostgreSQL](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL%2016+-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tests](https://img.shields.io/badge/Tests-49%20Passed-brightgreen.svg)]()
[![Razorpay](https://img.shields.io/badge/Taxonomy-Official%20Razorpay%20v2026--09-0284c7.svg)]()
[![L3Cube-HingCorpus](https://img.shields.io/badge/Linguistics-L3Cube--HingCorpus%20%7C%20HingLID-f97316.svg)](https://github.com/l3cube-pune/code-mixed-nlp)
[![Compliance](https://img.shields.io/badge/Compliance-RBI%20FPC%20%7C%20MSMED%20%7C%20DPDP-blue.svg)]()

---

## Overview

**Vaada** (वादा — *Promise / Commitment*) is an enterprise-grade, bounded B2B revenue-recovery system purpose-built for Indian merchants, MSMEs, and commercial suppliers. It ingests overdue payment events, classifies failure root causes via an **authoritative official Razorpay error taxonomy**, calculates statutory interest under Indian law, scores recovery probabilities via calibrated tabular ML, extracts promise-to-pay commitments from code-mixed Hinglish conversations backed by academic research (**L3Cube-HingCorpus & HingLID**), and orchestrates actions through a deterministic state machine.

The frontend is a fully designed premium digital product — a narrative operations console built for financial and revenue operations professionals, not developers.

### Core Architectural Principles

1. **The LLM never authorizes an action, never alters case state directly, and never bypasses statutory compliance.**
2. **Official Razorpay diagnostic data and Vaada's derived recovery policies are strictly isolated.**
3. **Linguistic research data (L3Cube-HingCorpus) and domain-specific payment data are strictly separated in provenance.**
4. **Zero hallucination on payment errors**: If an error code or reason is unmapped, it is honestly labeled as `UNMAPPED RAZORPAY ERROR` and routed safely to human review.
5. **Progressive disclosure**: Technical evidence (raw JSON, correlation IDs, decision DAGs) is Level 5 information — tucked into expandable trays, never presented as primary content.

---

## Key Capabilities & Highlights

```
                       ┌────────────────────────────────────────────────────────┐
                       │               VAADA SYSTEM PIPELINE                   │
                       └────────────────────────────────────────────────────────┘
                                                    │
  ┌───────────────────────────┐                     ▼                     ┌───────────────────────────┐
  │      EVENT INGESTION      │          ┌───────────────────────┐        │   STATUTORY ENGINE (IN)   │
  │ • Razorpay Webhooks / Ingest ────────▶│  OFFICIAL TAXONOMY   │◀───────│ • MSME Section 43B(h)     │
  │ • UPI, Card, Mandate Fail │          │ • 38 Published Errors │        │ • 3x RBI Bank Rate Comp.  │
  │ • E-Invoice IRN & GSTIN   │          │ • Zero-Hallucination  │        │ • Form 16A TDS Deductions │
  └───────────────────────────┘          └───────────────────────┘        └───────────────────────────┘
                                                    │
                                                    ▼
                                         ┌───────────────────────┐
                                         │  CLASSICAL ML SCORER  │
                                         │  Calibrated GBDT      │
                                         │  P(Recovery) 0.0-1.0  │
                                         └───────────────────────┘
                                                    │
                                                    ▼
                                         ┌───────────────────────┐
                                         │  WORKFLOW ENGINE/DAG  │
                                         │  Optimistic Locking   │
                                         │  Idempotent Executions│
                                         └───────────────────────┘
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
      ┌─────────────────────────┐                                       ┌─────────────────────────┐
      │  HINGLISH P2P ENGINE    │                                       │   RBI COMPLIANCE RAILS  │
      │ • Code-Mixed Extraction │                                       │ • Contact Window (IST)  │
      │ • Local LLM / Heuristic │                                       │ • Rolling 7-Day Cap     │
      │ • P2P Adherence Engine  │                                       │ • Anti-Harassment Tone  │
      └─────────────────────────┘                                       │ • Third-Party Shield    │
                   │                                                    │ • Legal ID Requirement  │
                   │                                                    └─────────────────────────┘
                   ▼                                                                 │
      ┌─────────────────────────┐                                                    ▼
      │  PAYMENT & CHANNELS     │                                       ┌─────────────────────────┐
      │ • Dynamic NPCI UPI QR   │                                       │  IMMUTABLE AUDIT TRAIL  │
      │ • ICICI Corporate VAN   │◀──────────────────────────────────────│  Zero-Trust Multi-Tenant│
      │ • WhatsApp HSM Cloud    │                                       │  Actor & Time Trace     │
      └─────────────────────────┘                                       └─────────────────────────┘
```

---

## Feature Deep-Dive

### 1. Official Razorpay Payment Error Taxonomy & Intelligence Explorer
Vaada embeds a versioned, local copy of Razorpay's published payment failure taxonomy (`data/razorpay/`):
- **Authoritative Coverage**: 38 official published failure codes spanning **UPI**, **Card / Netbanking / Mandate**, **Payment Method Parameters**, and **Common API Errors**.
- **Deterministic Lookup**: Prioritizes `(code, reason)` → `(method, reason)` → `(reason)` → `(code)` with zero hallucination fallback.
- **Dual-Layer Architecture**:
  - `Payment Diagnosis`: Verbatim official fields (`code`, `reason`, `source`, `step`, `description`, `official_next_step`, `official_source_url`).
  - `Recovery Interpretation`: Derived policy logic (`recoverability`, `retryable`, `urgency`, `recommended_actions`, `policy_decision`).
- **Error Intelligence Explorer (`/razorpay-taxonomy`)**: Interactive operations console providing real-time multi-facet filtering (Method, Source, Step, Recoverability), drawer deep-inspection, and a live payload diagnostic simulator sandbox.

### 2. India B2B Statutory & Tax Engine
Indian recovery workflows operate within stringent statutory frameworks. Vaada natively executes:
- **Income Tax Act Section 43B(h)**: Tracks statutory payment windows (45 days with written agreement, 15 days without) for Micro and Small enterprise suppliers. Flags tax deduction disallowance risks and calculates buyer tax exposures (~31.2%).
- **MSMED Act 2006 (Section 15, 16, 17, 18)**: Computes statutory compound penal interest with monthly rests at **3× the RBI Bank Rate** from the appointed day.
- **Statutory Legal Notice Generator**: Produces formal markdown legal notices including:
  - Section 43B(h) Tax Disallowance Advisory Notices (7-day cure).
  - Section 138 Negotiable Instruments Act / Section 25 PSSA Legal Demand Notices (15-day cure).
  - MSME Samadhaan (MSEFC) Form 1 Pre-Filing Dispute Notices.
  - Formal Statement of Account (SOA) & Balance Confirmation.
- **TDS Reconciliation (Section 194C / 194J)**: Resolves withholding tax deductions with Form 16A acknowledgement tracking, automatically updating net payable amounts without treating tax credits as defaults.
- **Dynamic Cash Discounting**: Implements early cash settlement incentives (e.g., 2% discount if settled within 10 days).

### 2. Regulatory Compliance & RBI Guardrails Registry
All outbound communication is evaluated against hard software guardrails before dispatch:
- **Contact Window Enforcement**: Hard stop for contacts outside `09:00–20:00 IST` (or `08:00–19:00 IST`), Monday through Saturday. Sunday and holiday contact is strictly blocked (*RBI Master Direction - Fair Practices Code for REs*).
- **Rolling Frequency Limiter**: Maximum 3 outbound contact attempts per customer case in any rolling 7-day window.
- **Tone & Intimidation Filter**: Prohibits abusive language, harassment, or unlawful coercion.
- **Third-Party Disclosure Shield**: Verifies recipient identity to prevent disclosing debt or invoice amounts to unauthorized parties (*DPDP Act 2023 / RBI Conduct Guidelines*).
- **Mandatory Legal Identification**: Every outbound communication must contain the legal registered name of the merchant entity.

### 3. Classical Tabular ML Recovery Scorer
Rather than delegating probabilistic forecasting to generative models, Vaada utilizes a tabular Machine Learning model:
- **Architecture**: `GradientBoostingClassifier` with `CalibratedClassifierCV` (sigmoid calibration).
- **Features**: Failure root cause, log-transformed invoice amount, days past due (DPD), prior contact attempts, and day of week.
- **Performance**: Held-out test ROC-AUC of `0.7215`, Brier score of `0.2076`.
- **Policy**: Cases with $P(\text{recovery}) < 25\%$ are automatically flagged for manual review rather than aggressive automated outreach.

### 4. Real Code-Mixed Hinglish Intelligence (L3Cube-HingCorpus + HingLID)
Indian B2B commerce conversations over WhatsApp and SMS overwhelmingly occur in Hindi-English code-mixing (*"bhai abhi balance nahi hai, Friday tak pakka clear kar dunga"*).
- **Academic Foundation**: Integrated with **L3Cube-HingCorpus & HingLID** research resources (*Nayak & Joshi, 2022*). Evaluated on real academic code-mixed datasets (`95.0%` Language ID accuracy).
- **Robust Preprocessing**: NFKC normalization, noise stripping, and colloquial repetition collapsing (*"bhaaaai"* → *"bhai"*, *"plzz"* → *"plz"*) without destroying Roman Hindi morphological stems.
- **Hybrid Language Identifier**: Real-time <1ms statistical classification distinguishing English, Roman Hindi, Devanagari Hindi, and code-mixed Hinglish with word ratio visualizers.
- **Language Signals Inspector**: Case Detail station exposes extracted Hindi signals (*"bhai"*, *"nahi hai"*, *"pakka"*) vs English commercial signals (*"balance"*, *"clear"*, *"Friday"*).
- **Domain Intent & Commitment Extraction**: Classifies 7 distinct intents (`promise_to_pay`, `vague_promise`, `dispute`, `already_paid`, `refusal`, `extension_request`, `no_commitment`) and calibrates commitment firmness (`high`, `medium`, `low`).
- **P2P Adherence Engine**: Monitors commitments, sends automated $T-1$ day reminders, and flags broken promises (*Vaada Khilafi*), escalating the customer's credit risk tier (`LOW` → `MEDIUM` → `HIGH` → `CRITICAL`).
- **Adversarial & Invariant Defense**: 100% test pass rate rejecting prompt injections, dispute claims, and negative payment statements.

### 5. Indian Payment Rails & Channel Simulators
- **Dynamic NPCI UPI Intent Links**: Generates one-click UPI links (`upi://pay?pa=...&am=...&tr=...`) with embedded transaction references.
- **Corporate Virtual Accounts (VAN)**: Issues dedicated ICICI Bank Virtual Account Numbers for real-time NEFT/RTGS settlement attribution.
- **WhatsApp Cloud API Interactive HSM**: Formats Meta-compliant interactive message templates with action buttons (*Pay UPI*, *Commit Date*, *Submit TDS*).

### 6. Indian Payment Rails & Channel Simulators
- **Dynamic NPCI UPI Intent Links**: Generates one-click UPI links (`upi://pay?pa=...&am=...&tr=...`) with embedded transaction references.
- **Corporate Virtual Accounts (VAN)**: Issues dedicated ICICI Bank Virtual Account Numbers for real-time NEFT/RTGS settlement attribution.
- **WhatsApp Cloud API Interactive HSM**: Formats Meta-compliant interactive message templates with action buttons (*Pay UPI*, *Commit Date*, *Submit TDS*).

### 7. Operations Console & Immutable Audit Log
- **Multi-Tenant Security**: Role-based access control (`admin`, `manager`, `operator`, `viewer`) with tenant isolation on every SQL query.
- **Optimistic Locking**: Version tracking (`expected_version`) on cases to prevent race conditions during concurrent operator overrides.
- **Auditability**: Every transition, compliance evaluation, notice dispatch, and manual override writes to an append-only `AuditEvent` log with user attribution and correlation IDs.

---

## System Architecture

```
[ Frontend: Next.js 15 App Router ]
   │
   ├── Public Landing (/)              Cinematic 6-scene narrative scroll
   │                                   Scene 1: Portfolio crisis telemetry
   │                                   Scene 2: Interactive Razorpay failure comparison
   │                                   Scene 3: Hinglish NLP word-level tokenizer
   │                                   Scene 4: Section 43B(h) statutory calculator
   │                                   Scene 5: Data provenance transparency
   │                                   Scene 6: Console launchpad
   │
   ├── Auth (/login)                   Argon2id-backed session, HttpOnly cookies
   ├── Queue (/queue)                  Executive financial ledger, portfolio health strip
   ├── Case Dossier (/cases/[id])      4-chapter progressive investigation narrative
   │                                   Level 5 progressive disclosure (raw JSON in trays)
   ├── Audit (/audit)                  Human-readable immutable activity ledger
   ├── Settings (/settings)            Compliance registry & tenant configuration
   └── Taxonomy (/razorpay-taxonomy)   Live Razorpay error explorer & simulator
   │
   ▼ HTTP (same-origin proxy · CSRF · HttpOnly cookies)
[ Backend: FastAPI Modular Monolith ]
   │
   ├── /app/api/           REST endpoints & request validation schemas
   ├── /app/authz/         Principal injection & RBAC dependency guards
   ├── /app/core/          Security, Argon2id, config, middleware
   ├── /app/services/
   │    ├── statutory.py   MSME 43B(h), 3× RBI interest, legal notice templates
   │    ├── compliance.py  RBI FPC, frequency limiter, window & tone rules
   │    ├── cases.py       Case lifecycle mutations & override orchestration
   │    ├── channels.py    Dynamic UPI & WhatsApp Cloud API payloads
   │    ├── p2p.py         Promise adherence evaluation & broken P2P tracking
   │    └── ingestion.py   Deduplicated payment event pipeline
   ├── /app/extraction/    Hinglish prompts, validators & heuristic fallbacks
   ├── /app/scoring/       Tabular GBDT scorer & feature extractors
   └── /app/db/            SQLAlchemy ORM models & session management
   │
   ▼ Database
[ SQLite (default) / PostgreSQL 16 ]
```

### Frontend Design System

| Layer | Token | Value |
|---|---|---|
| Background deep | `--bg-deep` | `#08090c` |
| Background surface | `--bg-surface` | `#0e1014` |
| Background elevated | `--bg-elevated` | `#15181f` |
| Accent / CTA | `--accent` | `#e09f3e` (amber) |
| Recovered / settled | `--color-recovered` | `#10b981` (emerald) |
| Disallowance / risk | `--color-disallowed` | `#ef4444` (crimson) |
| Display font | Syne (500–800) | Headlines, brand mark |
| UI / Body font | Plus Jakarta Sans (400–700) | All prose, labels, nav |
| Financial data font | JetBrains Mono (400–600) | Currency, GSTINs, UTR codes |

### Progressive Disclosure Hierarchy

| Level | What it shows | Where |
|---|---|---|
| 1 | What is happening — debtor name, amount, days overdue | Case telemetry strip (always visible) |
| 2 | Why it happened — gateway failure translated to business cause | Chapter 2 primary content |
| 3 | What should happen — recommended operator action | Action deck, focus banner |
| 4 | Why the system decided this — compliance rules, risk score | Expandable policy section |
| 5 | Raw evidence — gateway JSON, correlation IDs, decision DAG | Collapsible "Inspect ↓" trays only |

---

## Directory Structure

```text
Vaada/
├── .env.example                # Sample environment configuration template
├── docker-compose.yml          # Local PostgreSQL 16 service
├── README.md                   # System documentation
├── backend/
│   ├── pytest.ini              # Pytest configuration
│   ├── requirements.txt        # Python backend dependencies
│   ├── app/
│   │   ├── main.py             # FastAPI entrypoint & middleware configuration
│   │   ├── seed.py             # Rich database seeder (Indian B2B test fixtures)
│   │   ├── api/
│   │   │   ├── routes.py       # REST API endpoints & route handlers
│   │   │   ├── schemas.py      # Pydantic request/response schemas
│   │   │   └── cookies.py      # Cookie lifecycle & session managers
│   │   ├── authz/
│   │   │   ├── deps.py         # Principal dependency injection & session verification
│   │   │   └── permissions.py  # RBAC permission matrix
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic Settings management
│   │   │   ├── security.py     # Argon2 password hashing & JWT token handling
│   │   │   ├── middleware.py   # Rate limiting & security headers
│   │   │   └── errors.py       # Domain exception hierarchy
│   │   ├── db/
│   │   │   ├── models.py       # SQLAlchemy 2.0 ORM models
│   │   │   └── session.py      # Engine configuration & connection pooling
│   │   ├── events/
│   │   │   ├── synthetic.py    # Synthetic payment failure generator
│   │   │   └── razorpay.py     # Razorpay webhook signature validator
│   │   ├── extraction/
│   │   │   ├── promise_extractor.py # Code-mixed extraction pipeline
│   │   │   ├── validator.py    # Business rule validation for promises
│   │   │   ├── prompts.py      # LLM few-shot system prompts
│   │   │   └── schemas.py      # Pydantic promise schemas
│   │   ├── llm/
│   │   │   └── client.py       # Resilient Ollama HTTP client
│   │   ├── scoring/
│   │   │   └── model.py        # Tabular GBDT recovery probability scorer
│   │   └── services/
│   │       ├── statutory.py    # MSME 43B(h), 3x RBI interest & notice generation
│   │       ├── compliance.py   # RBI Fair Practices Code rule enforcement
│   │       ├── cases.py        # Case lifecycle service & override handler
│   │       ├── channels.py     # UPI intent URI & WhatsApp HSM composers
│   │       ├── p2p.py          # Promise adherence & broken promise detection
│   │       ├── ingestion.py    # Deduplicated payment event ingestion
│   │       └── workflow.py     # Deterministic 7-state DAG engine
│   └── tests/
│       ├── test_auth.py        # Authentication & session test suite
│       ├── test_domain.py      # Rule matching & domain validation tests
│       ├── test_security.py    # CSRF, RBAC & tenant boundary tests
│       └── test_statutory.py   # MSME 43B(h), 3x RBI interest & UPI link tests
├── frontend/
│   ├── package.json            # Node dependencies (Next.js 15, motion/react, Lenis)
│   ├── tsconfig.json           # TypeScript configuration
│   ├── next.config.ts          # Same-origin proxy rewrite: /api/v1/* → :8000
│   ├── app/
│   │   ├── globals.css         # Design tokens, typography, motion curves
│   │   ├── layout.tsx          # 3-tier font stack (Syne / Plus Jakarta Sans / JetBrains Mono)
│   │   ├── page.tsx            # Public homepage (→ Landing)
│   │   ├── login/page.tsx      # Operator authentication gateway
│   │   ├── queue/page.tsx      # Executive financial ledger & operations console
│   │   ├── cases/[id]/page.tsx # 4-chapter narrative case investigation dossier
│   │   ├── audit/page.tsx      # Human-readable immutable audit ledger
│   │   ├── settings/page.tsx   # Compliance guardrail configuration
│   │   └── razorpay-taxonomy/  # Live taxonomy explorer & diagnostic simulator
│   ├── components/
│   │   ├── Landing.tsx         # Cinematic 6-scene landing narrative
│   │   ├── Preloader.tsx       # Entry preloader animation
│   │   ├── SmoothScroll.tsx    # Lenis smooth scroll provider
│   │   └── PageTransition.tsx  # Page transition wrapper
│   └── lib/
│       └── api.ts              # Authenticated fetch client with CSRF & cookie support
└── docs/                       # Technical specifications & benchmark reports
```

---

## Local Setup & Quickstart

### Prerequisites
- **Python 3.11+**
- **Node.js 20+** and `npm`
- **Docker & Docker Compose** (Optional, for local PostgreSQL)
- **Ollama** (Optional, for running local LLM extraction)

---

### Step 1: Environment Configuration

Copy `.env.example` to the **repository root** `.env` (not inside `backend/.env`):

```bash
cp .env.example .env
```

Generate secure secrets and update `.env`:

```bash
# Generate a secure JWT secret:
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Sample `.env`:
```ini
VAADA_ENV=development
VAADA_DEBUG=false
VAADA_LOG_LEVEL=INFO

VAADA_API_HOST=0.0.0.0
VAADA_API_PORT=8000
VAADA_CORS_ORIGINS=http://localhost:3004

VAADA_COOKIE_SECURE=false
VAADA_COOKIE_SAMESITE=lax

VAADA_JWT_SECRET=your-random-48-character-secret
VAADA_JWT_ISSUER=vaada-local
VAADA_JWT_AUDIENCE=vaada-ops-console
VAADA_ACCESS_TOKEN_MINUTES=15
VAADA_REFRESH_TOKEN_DAYS=7

# Default SQLite (no external setup required):
VAADA_DATABASE_URL=sqlite:///./vaada.db
# Or PostgreSQL via Docker:
# VAADA_DATABASE_URL=postgresql+psycopg://vaada:vaada@localhost:5432/vaada

VAADA_LLM_BASE_URL=http://127.0.0.1:11434
VAADA_LLM_MODEL=llama3:8b

VAADA_SEED_ADMIN_EMAIL=operator@vaada.local
VAADA_SEED_ADMIN_PASSWORD=123456789
```

---

### Step 2: Backend Setup & Seeding

1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```

2. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. (Optional) Start PostgreSQL if using Postgres:
   ```bash
   docker compose up -d postgres
   ```

4. Populate the database with rich Indian B2B test cases:
   ```bash
   python -m app.seed
   ```

5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

---

### Step 3: Frontend Setup

1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   npm install
   ```

2. Start the Next.js development server:
   ```bash
   npm run dev        # development on :3004
   # or for production:
   npm run build && npx next start -p 3004
   ```

3. Open your browser:

   | URL | Description |
   |---|---|
   | [http://localhost:3004](http://localhost:3004) | Public landing narrative |
   | [http://localhost:3004/login](http://localhost:3004/login) | Operator authentication |
   | [http://localhost:3004/queue](http://localhost:3004/queue) | Operations console (requires auth) |
   | [http://localhost:8000/docs](http://localhost:8000/docs) | FastAPI auto-generated API docs |

   > **Note**: The Next.js frontend proxies all `/api/v1/*` requests to the backend via `next.config.ts`. This ensures same-origin HttpOnly cookie delivery without any CORS configuration needed on the frontend.

---

## Demo Credentials & Seed Scenarios

Running `python -m app.seed` sets up two test accounts:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Operator / Admin** | `operator@vaada.local` | `123456789` | Full access — ingest, act, notice generation, TDS, overrides |
| **Viewer** | `viewer@vaada.local` | `123456789` | Read-only — cases, metrics, audit logs |

### Seeded Scenarios Include

- **Kalyani Infrastructure Ltd** (`INV-2026-0891`): MSME Small enterprise invoice with 43B(h) disallowance notice and accrued compound interest.
- **Mehta Fabrics Pvt Ltd** (`INV-SYN-1002`): Insufficient funds bounce in `awaiting_action` with NPCI dynamic UPI QR generated.
- **Sharma & Sons Exports** (`INV-SYN-1003`): Mandate failure with high classical recovery probability.
- **Kapoor Agri Inputs** (`INV-SYN-1004`): Hinglish promise *"bhai abhi balance nahi hai, Friday shaam 4 baje 1.85L RTGS kar dunga pakka"* — demonstrates word-level tokenization, structured P2P extraction, and binding commitment card.
- **Patel Paper Mills** (`INV-SYN-1007`): Active Hinglish promise commitment extracted from customer response.
- **Apex Garments** (`INV-SYN-1008`): Broken promise (*Vaada Khilafi*) escalating credit risk tier to `CRITICAL`.

---

## Testing & Quality Assurance

Vaada includes a comprehensive pytest suite covering security, authentication, domain logic, statutory calculations, and compliance rules:

```bash
cd backend
pytest -v
```

### Test Coverage Highlights:
- `test_auth.py`: Password hashing, session issuance, refresh token rotation, unauthenticated access rejection.
- `test_domain.py`: Deterministic cause classification, promise extraction bounds, DAG state transition invariants, third-party disclosure prevention.
- `test_security.py`: Role-based function authorization, tenant isolation, double-submit CSRF enforcement.
- `test_statutory.py`: 43B(h) agreement cutoff calculations (45 vs 15 days), MSMED Act Section 16 3× RBI compound interest math, statutory notice generation, dynamic UPI string formatting.

---

## API Reference

The backend exposes a fully documented REST API at `http://localhost:8000/api/v1`.

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/login` — Authenticate and issue secure HTTP-only cookies (`vaada_access`, `vaada_refresh`, `vaada_csrf`).
- `POST /api/v1/auth/refresh` — Rotate refresh token and extend access session.
- `POST /api/v1/auth/logout` — Revoke active session and clear cookies.
- `GET /api/v1/auth/me` — Inspect current principal, active tenant, and assigned role.

#### Event Ingestion
- `POST /api/v1/events` — Ingest a payment failure event for an invoice.
- `POST /api/v1/events/synthetic` — Batch trigger synthetic test events for testing.
- `POST /api/v1/webhooks/razorpay` — Ingest Razorpay test webhook with HMAC-SHA256 signature verification.

#### Case Operations & Actions
- `GET /api/v1/cases` — List active recovery cases with pagination and summary metrics.
- `GET /api/v1/cases/{case_id}` — Retrieve 7-station case detail, decision trace, and audit logs.
- `POST /api/v1/cases/{case_id}/actions` — Execute case actions (`send_reminder`, `pause`, `resume`, `escalate`, `mark_recovered`, `mark_unrecoverable`, `cancel`).
- `POST /api/v1/cases/{case_id}/customer-replies` — Ingest customer Hinglish reply for P2P extraction.

#### Statutory & Reconciliation
- `POST /api/v1/cases/{case_id}/notices/generate` — Generate statutory notices (`msme_43b_h`, `sec_138_ni_act`, `msme_samadhaan_form_1`, `statement_of_account`).
- `POST /api/v1/cases/{case_id}/reconciliation/tds` — Reconcile Form 16A withholding tax and adjust net payable.
- `POST /api/v1/cases/{case_id}/reconciliation/payment` — Record bank UTR / payment remittance.
- `POST /api/v1/cases/{case_id}/discount` — Apply cash discount for early settlement.
- `POST /api/v1/cases/{case_id}/p2p/check-adherence` — Evaluate promise adherence and flag broken commitments.
- `GET /api/v1/statutory/portfolio-risk` — Aggregate Section 43B(h) and MSMED interest risk for the tenant.

---

## Security Model & Compliance Posture

| Risk Area | Mitigation in Vaada |
|---|---|
| **Broken Object-Level Auth (BOLA)** | Every database query enforces `tenant_id` predicates derived from the cryptographically verified session token, preventing cross-tenant access. |
| **CSRF Attacks** | Mutating endpoints require double-submit `X-CSRF-Token` headers matching the HttpOnly cookie signature. |
| **Password Storage** | `argon2-cffi` Argon2id hashing — no plaintext or bcrypt. |
| **Prompt Injection / Jailbreak** | LLM inputs are isolated as untrusted data. The LLM produces only structured JSON and has zero tool execution privileges. |
| **Hallucinated State Changes** | All case transitions are validated against a strict DAG finite state machine. The LLM cannot mutate case state. |
| **Regulatory Harassment** | Executable RBI Fair Practices Code guardrails run before any communication dispatch; blocked attempts are logged to the audit trail. |
| **Audit Immutability** | An append-only `AuditEvent` log records all state changes, rule evaluations, notices, and overrides with actor attribution and correlation IDs. |

---

## Evaluation & ML Benchmarks

Empirical evaluations of Vaada's tabular ML model and Hinglish extraction pipeline are documented in [`docs/evaluation.md`](docs/evaluation.md):

- **Tabular ML Recovery Scorer**: Held-out test accuracy of `67.67%`, Precision of `70.00%`, ROC-AUC of `0.7215`, and calibrated Brier score of `0.2076`.
- **Hinglish Promise Extraction**: 100% extraction accuracy on benchmark test sets covering colloquial code-mixed Hindi-English phrases, with automatic failover to human review on ambiguous inputs.

---

## License

This project is licensed under the Apache 2.0 License. See the `LICENSE` file for details.

---

<div align="center">
  <sub>Built with precision for Indian B2B commerce. Designed to be bounded, compliant, and auditable.</sub>
</div>
