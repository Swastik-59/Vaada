# Known Limitations & Honest System Trade-offs

This document explicitly details known limitations, edge cases, and technical trade-offs in Vaada v0.1.0.

---

## 1. Local LLM Hinglish Extraction Edge Cases

### Complex Indirect Commitments
- **Limitation**: Highly indirect Hinglish phrasing involving conditional multi-party dependencies (e.g., *"Jab Hamare Client X Ka Cheque Clear Hoga 15 Ko Tab Hum Dedicated Account Me 80k Transfer Kar Sakte Hain"*) can result in confidence scores dropping below the `0.50` threshold.
- **Handling**: The validator rejects low-confidence extractions (`confidence < 0.50`) and forces case transition to `needs_human_review` instead of guessing payment dates or amounts.

### Date Discrepancies Across Indian Festival Calendars
- **Limitation**: Expressions tied to moveable regional holidays (e.g., *"Diwali Ke Baad Pay Kar Denge"*, *"Eid Ke Bad Payment Hoga"*) are not resolved to hard calendar dates by the heuristic fallback without active LLM date context injection.
- **Handling**: Unresolved date references flag the case for manual review.

---

## 2. ML Recovery Probability Scorer

### Synthetic Training Data Distribution
- **Limitation**: Scorer metrics reported in `/docs/evaluation.md` (ROC-AUC ~0.72) are trained on calibrated synthetic ground-truth event distributions. Historical AR dataset distribution shift will require online re-calibration when deployed in production merchant environments.
- **Handling**: The model exposes a clean feature extraction pipeline (`extract_features`) and joblib artifact loader (`app/scoring/model.py`) to support automated re-training scripts.

---

## 3. Infrastructure & Deployment Dependencies

### Local In-Memory Rate Limiter
- **Limitation**: In single-instance deployments, the in-memory rate limiter protects endpoints cleanly. In multi-node horizontally scaled deployments, rate limiting requires Redis backing (`redis-py` or `slowapi`).
- **Handling**: The Render Free Tier deployment intentionally remains single-instance and treats rate limiting as best-effort protection. A production deployment requires a shared, durable rate-limit store before horizontal scaling.

### Render Free Tier Availability and Persistence
- **Limitation**: Render Free web services can spin down after inactivity, restart without notice, and have an ephemeral filesystem. Free Render Postgres databases expire after 30 days and do not provide backups.
- **Handling**: Vaada's deployment configuration keeps application processes stateless and uses Postgres for durable relational data. It does not run persistent schedulers or store uploaded data locally. Production deployment requires a non-expiring database, a durable worker/queue, object storage for uploads, and monitored cold-start behavior.

### Ollama Model Serving Latency
- **Limitation**: Local GGUF 7B quantization running on CPU-only developer environments may take 2.5–4.0 seconds per extraction call.
- **Handling**: Structured output extraction calls execute asynchronously or fall back to deterministic regex parsing within 50ms when LLM latency exceeds timeouts (`VAADA_LLM_TIMEOUT_SECONDS`).
