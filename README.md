# Vaada (वादा)
### Bounded, Compliant B2B Revenue-Recovery System for Indian Enterprises

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js 15](https://img.shields.io/badge/Next.js-15.1.12+-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![SQLite / PostgreSQL](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL%2016+-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Alembic](https://img.shields.io/badge/Migrations-Alembic-red.svg)](./backend/alembic)
[![Docker](https://img.shields.io/badge/Container-Docker-2496ED.svg?logo=docker&logoColor=white)](./docker-compose.yml)
[![Tests](https://img.shields.io/badge/Tests-100%20Passed-brightgreen.svg)](./backend/tests)
[![Razorpay](https://img.shields.io/badge/Taxonomy-Official%20Razorpay%20v2026--09-0284c7.svg)]()
[![L3Cube-HingCorpus](https://img.shields.io/badge/Linguistics-L3Cube--HingCorpus%20%7C%20HingLID-f97316.svg)](https://github.com/l3cube-pune/code-mixed-nlp)
[![Compliance](https://img.shields.io/badge/Compliance-RBI%20FPC%20%7C%20MSMED%20%7C%20DPDP-blue.svg)]()
[![Demo Video](https://img.shields.io/badge/Demo%20Video-Google%20Drive-red.svg?logo=google-drive&logoColor=white)](https://drive.google.com/file/d/1Vo0Ja56-99YX1C3KN5aF97Ne0omrCfrt/view?usp=sharing)

---

## 🎬 Product Demo Video

[![Watch Demo Video](https://img.shields.io/badge/Watch%20Demo-Google%20Drive%20Video-E11D48?style=for-the-badge&logo=google-drive&logoColor=white)](https://drive.google.com/file/d/1Vo0Ja56-99YX1C3KN5aF97Ne0omrCfrt/view?usp=sharing)

> 📹 **Live Walkthrough**: [Watch the Vaada Demo on Google Drive](https://drive.google.com/file/d/1Vo0Ja56-99YX1C3KN5aF97Ne0omrCfrt/view?usp=sharing)  
> Full end-to-end walkthrough demonstrating:
> - **Payment Failure Diagnosis**: Real-time evaluation against the authoritative Razorpay Error Taxonomy.
> - **India Statutory Engine**: Automated MSME 43B(h) due-date tracking, 3x RBI statutory interest compounding, and Form 16A TDS reconciliation.
> - **Code-Mixed Hinglish Intelligence**: Promise-to-pay extraction with heuristic fallback and L3Cube benchmark grounding.
> - **Executive & Operator Consoles**: Bounded human-in-the-loop workflows, dynamic NPCI UPI links, and customer settlement portal.

---

## Overview

**Vaada** (वादा — *Promise / Commitment*) is an enterprise-grade, bounded B2B revenue-recovery system purpose-built for Indian merchants, MSMEs, and commercial suppliers. It ingests overdue payment events, classifies failure root causes via an **authoritative official Razorpay error taxonomy**, calculates statutory interest under Indian law, scores recovery probabilities via calibrated tabular ML, extracts promise-to-pay commitments from code-mixed Hinglish conversations backed by academic research (**L3Cube-HingCorpus & HingLID**), and orchestrates actions through a deterministic state machine with full Razorpay webhook reconciliation.

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
  │ • Razorpay Webhooks/Ingest────────▶  │  OFFICIAL TAXONOMY   │◀───────│ • MSME Section 43B(h)     │
  │ • UPI, Card, Mandate Fail │          │ • 38 Published Errors │        │ • 3x RBI Bank Rate Comp.  │
  │ • Bulk CSV (CWE-1236 Safe)│          │ • Zero-Hallucination  │        │ • Form 16A TDS Deductions │
  │ • E-Invoice IRN & GSTIN   │          └───────────────────────┘        └───────────────────────────┘
  └───────────────────────────┘
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
                   │
                   ▼
      ┌─────────────────────────┐
      │  RAZORPAY WEBHOOK RECON │
      │ • HMAC-SHA256 Verified  │
      │ • Idempotent Processing │
      │ • Full Reconciliation   │
      └─────────────────────────┘
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

### 3. Regulatory Compliance & RBI Guardrails Registry
All outbound communication is evaluated against hard software guardrails before dispatch:
- **Contact Window Enforcement**: Hard stop for contacts outside `09:00–20:00 IST`, Monday through Saturday. Sunday contact is strictly blocked (*RBI Master Direction - Fair Practices Code for REs*).
- **Rolling Frequency Limiter**: Maximum 3 outbound contact attempts per customer case in any rolling 7-day window.
- **Tone & Intimidation Filter**: Prohibits abusive language, harassment, or unlawful coercion.
- **Third-Party Disclosure Shield**: Verifies recipient identity to prevent disclosing debt or invoice amounts to unauthorized parties (*DPDP Act 2023 / RBI Conduct Guidelines*).
- **Mandatory Legal Identification**: Every outbound communication must contain the legal registered name of the merchant entity.

### 4. Classical Tabular ML Recovery Scorer
Rather than delegating probabilistic forecasting to generative models, Vaada utilizes a tabular Machine Learning model:
- **Architecture**: `GradientBoostingClassifier` with `CalibratedClassifierCV` (sigmoid calibration).
- **Features**: Failure root cause, log-transformed invoice amount, days past due (DPD), prior contact attempts, and day of week.
- **Performance**: Held-out test ROC-AUC of `0.7215`, Brier score of `0.2076`.
- **Policy**: Cases with $P(\text{recovery}) < 25\%$ are automatically flagged for manual review rather than aggressive automated outreach.

### 5. Real Code-Mixed Hinglish Intelligence (L3Cube-HingCorpus + HingLID)
Indian B2B commerce conversations over WhatsApp and SMS overwhelmingly occur in Hindi-English code-mixing (*"bhai abhi balance nahi hai, Friday tak pakka clear kar dunga"*).
- **Academic Foundation**: Integrated with **L3Cube-HingCorpus & HingLID** research resources (*Nayak & Joshi, 2022*). Evaluated on real academic code-mixed datasets (`95.0%` Language ID accuracy).
- **Robust Preprocessing**: NFKC normalization, noise stripping, and colloquial repetition collapsing (*"bhaaaai"* → *"bhai"*, *"plzz"* → *"plz"*) without destroying Roman Hindi morphological stems.
- **Hybrid Language Identifier**: Real-time <1ms statistical classification distinguishing English, Roman Hindi, Devanagari Hindi, and code-mixed Hinglish with word ratio visualizers.
- **Language Signals Inspector**: Case Detail station exposes extracted Hindi signals (*"bhai"*, *"nahi hai"*, *"pakka"*) vs English commercial signals (*"balance"*, *"clear"*, *"Friday"*).
- **Domain Intent & Commitment Extraction**: Classifies 7 distinct intents (`promise_to_pay`, `vague_promise`, `dispute`, `already_paid`, `refusal`, `extension_request`, `no_commitment`) and calibrates commitment firmness (`high`, `medium`, `low`).
- **P2P Adherence Engine**: Monitors commitments, sends automated $T-1$ day reminders, and flags broken promises (*Vaada Khilafi*), escalating the customer's credit risk tier (`LOW` → `MEDIUM` → `HIGH` → `CRITICAL`).
- **Customer Portal NLP**: Customer submits free-text Hinglish ("bhai Friday ko transfer kar dunga") via the self-service portal; the extraction engine parses date, amount, and confidence without requiring structured form input.
- **Adversarial & Invariant Defense**: Prompt injection attempts and adversarial override phrases are detected and rejected with a `422` before any state change occurs.

### 6. Razorpay Webhook Reconciliation
Full closed-loop payment reconciliation over Razorpay webhooks:
- **HMAC-SHA256 Signature Verification**: Every webhook is validated against the configured secret before processing. Forged signatures return `403`.
- **Idempotency**: Duplicate `payment_id` + `event_type` combinations are safely deduplicated — no double-reconciliation.
- **State Machine Integration**: `payment.captured` events trigger `record_payment_reconciliation`, decrement `net_payable_minor`, and transition eligible cases to `recovered`.
- **Partial Payment Handling**: Payments below the invoice balance are captured and stored without incorrectly marking the case recovered.
- **Unmatched Invoice Fallback**: Webhook events with no matching invoice are accepted and audited rather than discarded or errored.

### 7. Background Surveillance Jobs
Four operational jobs runnable on-demand or schedulable:
- **`promise_adherence`**: Detects elapsed promises past their date, flags them as `broken`, transitions cases from `PROMISE_RECORDED → AWAITING_ACTION`, and records escalation actions with full correlation IDs.
- **`stale_cases`**: Flags cases that have been inactive for a configurable number of days (default: 7), routing them to institutional escalation.
- **`compliance_sweeper`**: Evaluates the current IST contact window and reports whether outbound communication is permitted.
- **`analytics`**: Computes real-time portfolio snapshots across all cases, invoices, and statutory risks for the tenant.

### 8. Customer Self-Service Portal
A tokenized, publicly-accessible customer portal for debtors:
- **JWT-Signed Access Tokens** (14-day expiry): Merchant-generated links that grant scoped access without requiring customer registration.
- **Invoice Dossier**: Displays outstanding amount, invoice number, payment breakdown, and statutory interest calculation.
- **Hinglish Promise Submission**: Customer can type free-form natural language ("bhai kal tak kar dunga"); NLP pipeline extracts structured commitment.
- **UPI Payment Link**: Deep-links to UPI apps for one-click settlement.
- **Dispute Submission**: Customer can raise TDS disputes or invoice disputes directly from the portal.

### 9. Portfolio Analytics & Three.js Visualizer
- **Real-Time Portfolio Metrics**: Total receivables book, active case count, recovery rate, recovered amount, and 43B(h) tax exposure, computed from live database state.
- **Financial Rails Topology**: Three.js WebGL scene visualizing payment rails and case flow as an animated network.
- **Recovery Funnel**: Visual funnel from ingested failures through classification, contact, promise, and reconciliation stages.

### 10. Operations Console & Immutable Audit Log
- **Multi-Tenant Security**: Role-based access control (`admin`, `manager`, `operator`, `viewer`) with tenant isolation on every SQL query.
- **Optimistic Locking**: Version tracking (`expected_version`) on cases to prevent race conditions during concurrent operator overrides.
- **Auditability**: Every transition, compliance evaluation, notice dispatch, manual override, and security event writes to an append-only `AuditEvent` log with user attribution and correlation IDs.

### 11. Bulk CSV Receivables Importer & Formula Injection Shield
Enterprise suppliers frequently operate across diverse ERPs (SAP, Tally, Zoho, Oracle). Vaada includes a robust CSV onboarding pipeline:
- **Security-First Formula Sanitization (ASVS V1.2 / CWE-1236)**: Cells beginning with risky spreadsheet command characters (`=`, `+`, `-`, `@`, `\t`, `\r`) are automatically escaped with a leading apostrophe before database entry.
- **Intelligent Pre-flight Validation**: Strict verification of required headers, numeric currency parsing into minor paise units, flexible date normalization (`YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, ISO), and validation of positive balances.
- **Batch & Database Collision Detection**: Prevents duplicate invoice ingest across both current file contents and historical tenant records.
- **Automatic Customer Entity Resolution**: Reconciles debtor records by matching customer name, email, or phone; creates new customers seamlessly when new buyers appear.
- **Immediate Recovery Case Bootstrapping**: Automatically generates corresponding payment events and onboards eligible invoices into the `INGESTED` recovery lifecycle with full actor attribution.
- **Interactive UI Modal & Template**: Built-in `ImportCsvModal.tsx` on the queue console featuring drag-and-drop file upload, live progress parsing, summary reports, and a downloadable standard CSV template (`GET /api/v1/invoices/template.csv`).

### 12. CFO Executive Console & Institutional Analytics
Beyond transactional debt collection, Vaada equips executive management with strategic cash-flow intelligence:
- **CFO Command Station (`/cfo`)**: High-level financial view designed for CFOs and treasury leaders. Surfaces macro receivables book value, Section 43B(h) tax disallowance liability exposure timelines, and real-time recovered capital.
- **Institutional Analytics Console (`/analytics`)**: Interactive analytical dashboard tracking recovery velocity curves, aging bucket breakdowns (0–15, 16–30, 31–45, and 45+ days overdue), failure root cause Pareto distributions, and compliance adherence audit rates.
- **Cash-Flow Forecasting**: Real-time projection model blending active promise-to-pay commitments with calibrated GBDT probabilities to forecast 7-day and 30-day liquidity inflows.

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
   ├── Queue (/queue, /queue/[uid])    Executive financial ledger, portfolio health strip,
   │                                   CSV batch importer, and Razorpay webhook simulator
   ├── CFO Console (/cfo)              Executive macro liquidity & 43B(h) tax exposure view
   ├── Analytics (/analytics)          Institutional portfolio analytics & recovery curves
   ├── Case Dossier (/cases/[id])      4-chapter progressive investigation narrative
   │                                   Level 5 progressive disclosure (raw JSON in trays)
   ├── Customer Portal (/portal/[tok]) Tokenized debtor self-service dossier + NLP promise
   ├── Audit (/audit)                  Human-readable immutable activity ledger
   ├── Settings (/settings)            Compliance registry & tenant configuration
   └── Taxonomy (/razorpay-taxonomy)   Live Razorpay error explorer & simulator
   │
   ▼ HTTP (same-origin proxy · CSRF · HttpOnly cookies)
[ Backend: FastAPI Modular Monolith ]
   │
   ├── /app/api/              REST endpoints, request validation schemas
   │    ├── routes.py          Merchant API (auth, cases, invoices, CSV import, webhooks)
   │    ├── portal_routes.py   Customer portal endpoints (dossier, promise, dispute, payment)
   │    └── schemas.py         Pydantic request/response models
   ├── /app/authz/            Principal injection & RBAC dependency guards
   ├── /app/core/             Security, Argon2id, config, middleware
   ├── /app/services/
   │    ├── statutory.py      MSME 43B(h), 3× RBI interest, legal notice templates
   │    ├── compliance.py     RBI FPC, frequency limiter, window & tone rules
   │    ├── cases.py          Case lifecycle mutations & override orchestration
   │    ├── channels.py       Dynamic UPI & WhatsApp Cloud API payloads
   │    ├── jobs.py           4 surveillance background workers
   │    ├── workflow.py       Deterministic state machine (9-state DAG)
   │    ├── razorpay_webhook.py HMAC-verified webhook processor & reconciler
   │    ├── ingestion.py      Deduplicated payment event pipeline
   │    ├── importer.py       CSV receivables bulk importer & formula injection shield
   │    ├── analytics.py      Portfolio risk, aging buckets & liquidity aggregation
   │    └── portal.py         Portal JWT token generation & verification
   ├── /app/extraction/       Hinglish prompts, validators & heuristic fallbacks
   ├── /app/scoring/          Tabular GBDT scorer & feature extractors
   ├── /app/db/               SQLAlchemy ORM models, wait.py connection polling
   └── /alembic/              Schema migration revisions & version tracking
   │
   ▼ Database
[ SQLite (default) / PostgreSQL 16 (Docker / Render) ]
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
├── .env.example                  # Sample environment configuration template
├── .dockerignore                 # Container build exclusion filters
├── docker-compose.yml            # Local PostgreSQL 16 service definition
├── render.yaml                   # Production deployment Blueprint (Render)
├── README.md                     # System documentation
├── docs/                         # In-depth architectural & evaluation specs
│   ├── ai-pipeline.md            # Hinglish extraction & NLP specification
│   ├── api-reference.md          # REST API endpoints & payload specifications
│   ├── architecture.md           # Modular monolith architecture & layers
│   ├── compliance.md             # RBI Fair Practices Code & MSMED Act specs
│   ├── data-provenance.md        # Academic vs synthetic data provenance
│   ├── evaluation.md             # Empirical ML & NLP benchmark results
│   ├── frontend.md               # Design tokens, motion guidelines & fonts
│   ├── known-limitations.md      # Honest trade-offs, edge cases & scope limits
│   ├── model-card.md             # Tabular GBDT scorer model card
│   ├── razorpay-integration.md   # Webhooks, error taxonomy & reconciliation
│   ├── security.md               # ASVS verification & security controls
│   └── security-notes.md         # Operational security review checklist
├── data/
│   ├── domain/                   # Payment failure & domain intent vocabularies
│   ├── linguistic/               # L3Cube-HingCorpus & HingLID academic assets
│   └── razorpay/                 # Official 38-code Razorpay taxonomy dataset
├── backend/
│   ├── Dockerfile                # Production container specification
│   ├── alembic.ini               # Alembic database migration configuration
│   ├── pytest.ini                # Pytest execution configuration
│   ├── requirements.txt          # Python backend dependencies
│   ├── verify_e2e_golden_path.py # Live E2E golden path + 12 failure path verifier
│   ├── alembic/
│   │   ├── env.py                # Alembic migration environment
│   │   └── versions/             # Relational schema migration scripts
│   └── app/
│       ├── main.py               # FastAPI entrypoint, middleware & health probes
│       ├── seed.py               # Database seeder (Indian B2B scenarios & users)
│       ├── api/
│       │   ├── routes.py         # Main REST API (cases, CSV import, jobs, webhooks)
│       │   ├── portal_routes.py  # Customer portal endpoints (promise, dispute)
│       │   ├── schemas.py        # Pydantic request/response validation schemas
│       │   └── cookies.py        # Cookie lifecycle & session managers
│       ├── authz/
│       │   ├── deps.py           # Principal injection & session verification
│       │   └── permissions.py    # Role-based access control matrix
│       ├── core/
│       │   ├── config.py         # Pydantic Settings management
│       │   ├── security.py       # Argon2id hashing & JWT token handlers
│       │   ├── middleware.py     # Rate limiting & security headers
│       │   └── errors.py         # Domain exception hierarchy
│       ├── db/
│       │   ├── models.py         # SQLAlchemy 2.0 ORM models
│       │   ├── session.py        # Database engine & session pooling
│       │   └── wait.py           # Database connection readiness poller
│       ├── events/
│       │   ├── synthetic.py      # Synthetic payment failure generator
│       │   └── razorpay.py       # Razorpay HMAC-SHA256 signature validator
│       ├── extraction/
│       │   ├── promise_extractor.py # Code-mixed extraction + injection defense
│       │   ├── validator.py      # Business rule validation for promises
│       │   ├── prompts.py        # LLM few-shot system prompts
│       │   └── schemas.py        # Pydantic promise schemas
│       ├── llm/
│       │   └── client.py         # Resilient Ollama HTTP client
│       ├── scoring/
│       │   └── model.py          # Tabular GBDT recovery probability scorer
│       └── services/
│           ├── analytics.py      # Portfolio risk & recovery metric aggregation
│           ├── statutory.py      # MSME 43B(h), 3x RBI interest & notice generator
│           ├── compliance.py     # RBI Fair Practices Code rule enforcement
│           ├── cases.py          # Case lifecycle & override orchestration
│           ├── channels.py       # UPI intent URI & WhatsApp HSM composers
│           ├── p2p.py            # Promise adherence & broken promise detection
│           ├── importer.py       # Bulk CSV receivables importer (CWE-1236 safe)
│           ├── ingestion.py      # Deduplicated payment event ingestion
│           ├── jobs.py           # 4 background surveillance workers
│           ├── workflow.py       # Deterministic 9-state DAG engine
│           ├── razorpay_webhook.py # Closed-loop Razorpay webhook reconciler
│           └── portal.py         # Customer portal JWT token management
│   └── tests/                    # 14 Comprehensive Test Suites (100 passed)
│       ├── test_adversarial_matrix.py
│       ├── test_auth.py
│       ├── test_bulletproof_identity.py
│       ├── test_customer_portal.py
│       ├── test_domain.py
│       ├── test_health.py
│       ├── test_hinglish_linguistics.py
│       ├── test_import.py
│       ├── test_jobs.py
│       ├── test_razorpay_taxonomy.py
│       ├── test_razorpay_webhook.py
│       ├── test_sample_data.py
│       ├── test_security.py
│       └── test_statutory.py
└── frontend/
    ├── package.json              # Next.js 15.1.12, motion, gsap, Three.js, Lenis
    ├── tsconfig.json             # TypeScript configuration
    ├── next.config.ts            # Same-origin proxy rewrite: /api/v1/* → :8000
    ├── middleware.ts             # Edge route protection & authentication guard
    ├── app/
    │   ├── globals.css           # Design tokens, typography, motion curves
    │   ├── layout.tsx            # 3-tier font stack (Syne / Plus Jakarta / JetBrains)
    │   ├── page.tsx              # Public homepage (→ Landing)
    │   ├── login/page.tsx        # Operator authentication gateway
    │   ├── queue/page.tsx        # Operations console & case ledger
    │   ├── queue/[uid]/page.tsx  # Scoped operator case queue
    │   ├── cfo/page.tsx          # CFO executive macro liquidity & tax view
    │   ├── analytics/page.tsx    # Institutional portfolio analytics & curves
    │   ├── cases/[id]/page.tsx   # 4-chapter narrative case investigation dossier
    │   ├── portal/[token]/       # Customer self-service settlement portal
    │   ├── audit/page.tsx        # Human-readable immutable audit ledger
    │   ├── settings/page.tsx     # Compliance guardrail configuration
    │   └── razorpay-taxonomy/    # Live taxonomy explorer & diagnostic simulator
    ├── components/
    │   ├── Landing.tsx           # Cinematic 6-scene landing narrative
    │   ├── HeroScene.tsx         # Three.js WebGL financial rails topology
    │   ├── ImportCsvModal.tsx    # Bulk CSV receivables upload & report modal
    │   ├── RazorpayWebhookModal.tsx # Interactive webhook simulator modal
    │   ├── AuthenticatedAppShell.tsx # Global responsive layout shell
    │   ├── DashboardNav.tsx      # Navigation header with tenant metrics
    │   ├── Preloader.tsx         # Entry preloader animation
    │   ├── SmoothScroll.tsx      # Lenis smooth scroll provider
    │   └── PageTransition.tsx    # Page transition wrapper
    └── lib/
        └── api.ts                # Authenticated fetch client with CSRF & cookie support
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

Copy `.env.example` to the **repository root** `.env`:

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
VAADA_CORS_ORIGINS=http://localhost:3000

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

# Razorpay webhook signature verification secret:
VAADA_RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret

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
   *(Alternatively, run schema migrations directly via `alembic upgrade head`)*

5. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000
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
   npm run dev        # development on :3000
   # or for production:
   npm run build && npm start
   ```

3. Open your browser:

   | URL | Description |
   |---|---|
   | [http://localhost:3000](http://localhost:3000) | Public landing narrative & interactive simulator |
   | [http://localhost:3000/login](http://localhost:3000/login) | Operator authentication gateway |
   | [http://localhost:3000/queue](http://localhost:3000/queue) | Operations console & receivables queue (requires auth) |
   | [http://localhost:3000/cfo](http://localhost:3000/cfo) | CFO Executive Macro Liquidity Console |
   | [http://localhost:3000/analytics](http://localhost:3000/analytics) | Institutional Portfolio Analytics & Recovery Curves |
   | [http://localhost:8000/docs](http://localhost:8000/docs) | FastAPI auto-generated interactive OpenAPI documentation |
   | [http://localhost:8000/health](http://localhost:8000/health) | Service liveness health check probe |

   > **Note**: The Next.js frontend proxies all `/api/v1/*` requests to the backend via `next.config.ts`. This ensures same-origin HttpOnly cookie delivery without any CORS configuration needed on the frontend.

### Seeded Scenarios Include

- **Kalyani Infrastructure Ltd** (`INV-2026-0891`): MSME Small enterprise invoice with 43B(h) disallowance notice and accrued compound interest.
- **Mehta Fabrics Pvt Ltd** (`INV-SYN-1002`): Insufficient funds bounce in `awaiting_action` with NPCI dynamic UPI QR generated.
- **Sharma & Sons Exports** (`INV-SYN-1003`): Mandate failure with high classical recovery probability.
- **Kapoor Agri Inputs** (`INV-SYN-1004`): Hinglish promise *"bhai abhi balance nahi hai, Friday shaam 4 baje 1.85L RTGS kar dunga pakka"* — demonstrates word-level tokenization, structured P2P extraction, and binding commitment card.
- **Patel Paper Mills** (`INV-SYN-1007`): Active Hinglish promise commitment extracted from customer response.
- **Apex Garments** (`INV-SYN-1008`): Broken promise (*Vaada Khilafi*) escalating credit risk tier to `CRITICAL`.

---

## Testing & Quality Assurance

Vaada includes 14 automated test suites covering security, authentication, domain logic, statutory calculations, CSV onboarding, background jobs, and compliance rules:

```bash
cd backend
pytest -v
# ============================ 100 passed in 18.41s ============================
```

### Test Coverage (14 Suites · 100 Tests)

| Test Suite | Items | Coverage & Focus |
|---|---|---|
| `test_adversarial_matrix.py` | 7 | Adversarial prompt injections, system prompt override attempts, and boundary defense. |
| `test_auth.py` | 5 | Password hashing (Argon2id), session issuance, refresh token rotation, unauthenticated access rejection. |
| `test_bulletproof_identity.py` | 16 | Principal verification, contact window enforcement (09:00–20:00 IST), and third-party disclosure shield. |
| `test_customer_portal.py` | 5 | Tokenized debtor portal sessions, dispute filing, and self-service promise submission. |
| `test_domain.py` | 9 | Deterministic root cause classification, promise extraction bounds, and DAG state transition invariants. |
| `test_health.py` | 2 | Liveness (`/health`) and database connection readiness (`/ready`) probes. |
| `test_hinglish_linguistics.py` | 15 | Code-mixed Hinglish normalization, Language ID against L3Cube benchmarks, and intent parsing. |
| `test_import.py` | 6 | CSV receivables upload, formula injection neutralization (CWE-1236), and batch & DB duplicate collision checks. |
| `test_jobs.py` | 7 | 4 surveillance workers (promise adherence, stale cases, compliance sweeper, analytics aggregation). |
| `test_razorpay_taxonomy.py` | 13 | Official 38 Razorpay failure error codes, deterministic fallback hierarchy, and policy mapping. |
| `test_razorpay_webhook.py` | 3 | HMAC-SHA256 signature verification, idempotency deduplication, and payment reconciliation. |
| `test_sample_data.py` | 4 | Seed data integrity, synthetic test scenario coverage, and entity relationship validation. |
| `test_security.py` | 3 | Role-based function authorization (RBAC), tenant boundary isolation, and double-submit CSRF protection. |
| `test_statutory.py` | 5 | MSME Section 43B(h) payment window cutoffs (45 vs 15 days), MSMED Act Section 16 3× RBI compound interest math, formal statutory notice generation, and dynamic UPI QR string formatting. |

### Live E2E Verification

A self-contained live E2E script verifies the full golden path and 12 failure paths against the running server:

```bash
# With both backend and frontend running:
cd backend
python verify_e2e_golden_path.py
```

**Golden Path** (18 checks): Merchant login → portfolio metrics → payment failure ingest → Razorpay diagnosis → customer portal → Hinglish NLP promise → surveillance jobs → IST compliance window → webhook reconciliation → `recovered` state → analytics mutation → audit trail.

**Failure Paths** (12 checks): HMAC forgery, expired tokens, unauthorized access, prompt injection, vague input, duplicate webhooks, missing CSRF, partial payments, compliance boundaries, worker retries.

---

## Vercel + Render deployment

Vaada deploys as two services: the Next.js application on Vercel and the FastAPI API on Render. The browser continues to call `/api/v1/*` on the Vercel origin; Next.js proxies these paths server-side to Render, preserving the existing cookie and CSRF model.

1. Create a Render Blueprint from [`render.yaml`](render.yaml). Set `VAADA_CORS_ORIGINS` to the exact Vercel production origin and add the Razorpay Test Mode variables if webhooks are enabled.
2. Set Vercel's server-only `VAADA_API_ORIGIN` to the HTTPS Render API origin, with no path or trailing slash.
3. Set `VAADA_COOKIE_SECURE=true` in Render. Do not set any `NEXT_PUBLIC_*` variable to a secret, token, or database URL.
4. Confirm `GET /health` returns `200` before routing frontend traffic. `GET /ready` additionally verifies database reachability.

The Render free tier is suitable for evaluation, not production: a web service can spin down after 15 minutes of inactivity, its filesystem is ephemeral, and a free Render Postgres database expires after 30 days. Use managed Postgres for all durable data; do not store uploads, SQLite data, or job state on the web-service filesystem. See [Render's free-tier documentation](https://render.com/docs/free) and [health-check documentation](https://render.com/docs/health-checks).

Local configuration belongs in the repository-root `.env`; see [`.env.example`](.env.example) for safe variable names and placeholders.

---

## API Reference

The backend exposes a fully documented REST API at `http://localhost:8000/api/v1` (with OpenAPI documentation at `/docs`).

### Key Endpoints

#### Authentication & Session
- `POST /api/v1/auth/login` — Authenticate and issue secure HTTP-only cookies (`vaada_access`, `vaada_refresh`, `vaada_csrf`).
- `POST /api/v1/auth/refresh` — Rotate refresh token and extend access session.
- `POST /api/v1/auth/logout` — Revoke active session and clear cookies.
- `GET /api/v1/auth/me` — Inspect current principal, active tenant, and assigned role.

#### Event Ingestion & Receivables Onboarding
- `GET /api/v1/invoices/template.csv` — Download standardized receivables CSV import template.
- `POST /api/v1/invoices/import` — Ingest bulk receivables via CSV file upload (`multipart/form-data`) or raw text / JSON payload, with formula injection sanitization (CWE-1236), batch & DB duplicate collision detection, and automated case bootstrapping.
- `POST /api/v1/events` — Ingest a single payment failure event for an invoice.
- `POST /api/v1/events/synthetic` — Batch trigger synthetic test events for testing.
- `POST /api/v1/webhooks/razorpay` — Ingest Razorpay webhook with HMAC-SHA256 signature verification and full reconciliation.

#### Razorpay Error Taxonomy
- `GET /api/v1/razorpay/taxonomy` — List official Razorpay published taxonomy errors enriched with derived Vaada recovery policies and multi-facet filtering.
- `GET /api/v1/razorpay/taxonomy/{entry_id}` — Retrieve a specific official Razorpay taxonomy entry by ID with derived policy mapping.
- `POST /api/v1/razorpay/lookup` — Deterministic lookup of raw or structured error payloads against the official taxonomy.

#### Case Operations & Actions
- `GET /api/v1/cases` — List active recovery cases with pagination and summary metrics.
- `GET /api/v1/cases/{case_id}` — Retrieve 7-station case detail, decision trace, portal access token, and audit logs.
- `POST /api/v1/cases/{case_id}/actions` — Execute case actions (`send_reminder`, `pause`, `resume`, `escalate`, `mark_recovered`, `mark_unrecoverable`, `cancel`).
- `POST /api/v1/cases/{case_id}/customer-replies` — Ingest customer Hinglish reply for P2P extraction.

#### Customer Portal
- `GET /api/v1/portal/{token}` — Retrieve customer dossier (invoice, amounts, payment options).
- `POST /api/v1/portal/{token}/promise` — Submit free-text or structured promise to pay (NLP extraction applied).
- `POST /api/v1/portal/{token}/payment` — Record self-service payment with UTR reference.
- `POST /api/v1/portal/{token}/dispute` — Submit TDS or invoice dispute.

#### Statutory & Reconciliation
- `POST /api/v1/cases/{case_id}/notices/generate` — Generate statutory notices (`msme_43b_h`, `sec_138_ni_act`, `msme_samadhaan_form_1`, `statement_of_account`).
- `POST /api/v1/cases/{case_id}/reconciliation/tds` — Reconcile Form 16A withholding tax and adjust net payable.
- `POST /api/v1/cases/{case_id}/reconciliation/payment` — Record bank UTR / payment remittance.
- `GET /api/v1/statutory/portfolio-risk` — Aggregate Section 43B(h) and MSMED interest risk for the tenant.

#### Portfolio & Analytics
- `GET /api/v1/metrics` — Real-time portfolio snapshot (total book, active cases, recovery rate, recovered amount).
- `POST /api/v1/jobs/trigger` — Trigger background surveillance jobs (`promise_adherence`, `stale_cases`, `compliance_sweeper`, `analytics`, `all`).
- `GET /api/v1/audit` — Paginated immutable audit event log.
- `GET /api/v1/settings/compliance` — Retrieve active compliance window configuration.

#### System Health Probes
- `GET /health` — Service liveness health check probe.
- `GET /ready` — Database connection readiness probe.

---

## Security Model & Compliance Posture

| Risk Area | Mitigation in Vaada |
|---|---|
| **Broken Object-Level Auth (BOLA)** | Every database query enforces `tenant_id` predicates derived from the cryptographically verified session token, preventing cross-tenant access. |
| **CSRF Attacks** | Mutating endpoints require double-submit `X-CSRF-Token` headers matching the HttpOnly cookie signature. Missing token returns `401`. |
| **Password Storage** | `argon2-cffi` Argon2id hashing — no plaintext or bcrypt. |
| **Webhook Forgery** | HMAC-SHA256 signature verified on every Razorpay webhook. Forged signatures return `403`. |
| **Formula Injection (CSV)** | Cells starting with dangerous formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) are escaped with a leading apostrophe before DB insertion (CWE-1236 / ASVS V1.2). |
| **Prompt Injection / Jailbreak** | Adversarial control phrases detected in `_heuristic_fallback` before any DB write. Rejected with `422` and audit event. |
| **Hallucinated State Changes** | All case transitions are validated against a strict DAG finite state machine. The LLM cannot mutate case state directly. |
| **Regulatory Harassment** | Executable RBI Fair Practices Code guardrails run before any communication dispatch; blocked attempts are logged to the audit trail. |
| **Audit Immutability** | An append-only `AuditEvent` log records all state changes, rule evaluations, notices, security events, and overrides with actor attribution and correlation IDs. |

---

## Evaluation & ML Benchmarks

Empirical evaluations of Vaada's tabular ML model and Hinglish extraction pipeline are documented in [`docs/evaluation.md`](docs/evaluation.md):

- **Tabular ML Recovery Scorer**: Held-out test accuracy of `67.67%`, Precision of `70.00%`, ROC-AUC of `0.7215`, and calibrated Brier score of `0.2076`.
- **Hinglish Promise Extraction**: 100% extraction accuracy on benchmark test sets covering colloquial code-mixed Hindi-English phrases, with automatic failover to human review on ambiguous inputs.
- **Language Identification**: 95.0% accuracy on L3Cube-HingCorpus academic dataset.

---

## Maintenance & Review Governance

- **Last Reviewed**: September 2026
- **Review Scope**: Evaluated against actual repository state, active test suites (100 passing tests), Dockerized deployment manifests, and OpenAPI REST endpoints.
- **Audience**: Engineering contributors, enterprise DevOps, CFO / treasury leadership, and regulatory auditors.

---

## License

This project is licensed under the Apache 2.0 License. See the `LICENSE` file for details.

---

<div align="center">
  <sub>Built with precision for Indian B2B commerce. Designed to be bounded, compliant, and auditable.</sub>
</div>
