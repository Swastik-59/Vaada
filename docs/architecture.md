# Architecture

Vaada is a modular FastAPI monolith plus a Next.js public site and operations console.

```text
Public site (/)
    -> operations login (/login)
        -> authenticated HTTP API
            -> authn/authz
            -> application services
                -> workflow / compliance / scoring / extraction
                -> SQLAlchemy/PostgreSQL
                -> LLM client (Ollama, optional)
```

Deterministic components own identity, tenancy, authorization, workflow transitions, compliance, persistence, audit, and official Razorpay taxonomy mapping. The LLM is used only to interpret unstructured text into a schema. The schema is validated before any case mutation.

Payment events are ingested via `ingest_payment_event`, which normalizes failure payloads against the local versioned Razorpay taxonomy (`data/razorpay/`). Official diagnostics (code, reason, source, step, official documentation link) are strictly isolated from derived Vaada recovery policies (recoverability, retryability, promise-to-pay extraction, statutory 43B(h) escalations).

Trust boundaries:

- Browser is untrusted.
- JWT cookies are trusted only after signature, issuer, audience, expiry, and type checks.
- Tenant scope is taken from membership, not from a client-supplied tenant id unless it matches a membership.
- Customer text is untrusted data inside extraction prompts.
- LLM JSON is untrusted until schema and business-rule validation succeed.
- Third-party error codes are validated against local official taxonomy datasets to prevent AI hallucination of banking failure reasons.
