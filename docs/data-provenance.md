# Data Provenance & Architectural Boundaries

This document defines the strict boundaries between **Official Third-Party Data**, **Realistic Synthetic Identities**, and **Derived Recovery Intelligence** in Vaada.

---

## 1. Provenance Classifications

| Layer | Source / Nature | Authoritative Status | Storage Location | Zero-Hallucination Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Official Razorpay Error Taxonomy** | Published Razorpay Developer Documentation (`https://razorpay.com/docs/errors/`) | **Authoritative & Verbatim** | `data/razorpay/*.json` | Immutable official records. No invented codes or unofficial explanations. |
| **Synthetic Business Entities & Cases** | Seed fixtures for India B2B commerce demo | **Synthetic / Test Fixtures** | `backend/app/seed.py`, `backend/vaada.db` | Contains realistic MSME GSTINs, Udyam IDs, IRNs, and Hinglish customer messages for demonstration. |
| **Derived Vaada Recovery Policies** | Deterministic domain logic & classification engines | **Derived Product Logic** | `backend/app/services/razorpay/policy_mapper.py` | Must NEVER be mixed into raw Razorpay payloads. Always namespaced as `recovery_interpretation` or `derived`. |

---

## 2. Official Razorpay Taxonomy Sources

The taxonomy dataset stored in `data/razorpay/` is constructed directly from official published developer documentation:

1. **Top-Level Error Directory**: [https://razorpay.com/docs/errors/](https://razorpay.com/docs/errors/)
2. **Payments Error Code List**: [https://razorpay.com/docs/errors/payments/list/](https://razorpay.com/docs/errors/payments/list/)
3. **UPI Payment Errors**: [https://razorpay.com/docs/errors/payments/upi/](https://razorpay.com/docs/errors/payments/upi/)
4. **Payment Method Error Parameters**: [https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/](https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/)
5. **Common API Errors**: [https://razorpay.com/docs/errors/common/](https://razorpay.com/docs/errors/common/)

### Metadata Manifest (`data/razorpay/taxonomy_metadata.json`)
```json
{
  "provider": "razorpay",
  "taxonomy_version": "razorpay-taxonomy-2026-09-01",
  "source": "official_documentation",
  "source_urls": [
    "https://razorpay.com/docs/errors/",
    "https://razorpay.com/docs/errors/payments/list/",
    "https://razorpay.com/docs/errors/payments/upi/",
    "https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/",
    "https://razorpay.com/docs/errors/common/"
  ]
}
```

---

## 3. Strict Boundary Enforcement

```
 ┌────────────────────────────────────────────────────────┐
 │            OFFICIAL RAZORPAY TAXONOMY DATA            │
 │  • code: "BAD_REQUEST_ERROR"                           │
 │  • reason: "insufficient_funds"                        │
 │  • source: "customer"                                  │
 │  • step: "payment_debit"                               │
 │  • description: "The customer's bank account has..."   │
 │  • official_next_step: "Advise customer to ensure..."  │
 │  • official_source_url: "https://razorpay.com/..."     │
 └──────────────────────────┬─────────────────────────────┘
                            │ Read-only lookup
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │           VAADA DERIVED RECOVERY INTELLIGENCE          │
 │  • recoverability: "recoverable"                       │
 │  • retryable: true                                     │
 │  • urgency: "medium"                                   │
 │  • policy_decision: "WAIT_FOR_PROMISED_DATE"           │
 │  • customer_promise: "Friday tak pakka kar dunga"     │
 │  • statutory_interest_minor: 185000                    │
 └────────────────────────────────────────────────────────┘
```

- **No Field Bleeding**: The backend API returns distinct keys: `payment_diagnosis` (official) and `recovery_interpretation` (derived).
- **Honest Unmapped Handling**: If a payment event contains an unknown failure code or unexpected error structure, the system sets `matched = false`, does **not** hallucinate explanations, labels it `UNMAPPED RAZORPAY ERROR`, and routes it directly to operator review.

---

## 4. Linguistic Research Foundation: L3Cube-HingCorpus & HingLID

### Academic Citation
```bibtex
@inproceedings{nayak2022l3cube,
  title={L3Cube-HingCorpus and HingBERT: A Code Mixed Hindi-English Dataset and BERT Language Models},
  author={Nayak, Ravindra and Joshi, Raviraj},
  booktitle={Proceedings of the 9th Workshop on Balto-Slavic Natural Language Processing (BSNLP) / WILDRE-6 at LREC 2022},
  pages={1--6},
  year={2022}
}
```

### Resource Details
- **Source**: L3Cube Pune / Ravindra Nayak & Raviraj Joshi (2022)
- **Official Repository**: [https://github.com/l3cube-pune/code-mixed-nlp](https://github.com/l3cube-pune/code-mixed-nlp)
- **ACL Anthology**: [https://aclanthology.org/2022.wildre-1.2/](https://aclanthology.org/2022.wildre-1.2/)
- **arXiv Preprint**: [https://arxiv.org/abs/2204.08398](https://arxiv.org/abs/2204.08398)
- **License**: CC-BY-4.0 / MIT (Academic Research & Prototype Evaluation)
- **Storage Location**: `data/linguistic/l3cube/` (`source_metadata.json`, `samples.json`)

### Strict Scope & Data Boundaries
1. **Linguistic Scope Only**: L3Cube-HingCorpus is a large-scale real Hindi-English code-mixed corpus written in Roman script. It is utilized in Vaada exclusively to evaluate **language identification (HingLID)**, **code-switching detection**, and **syntactic text normalization**.
2. **NOT Payment Data**: L3Cube-HingCorpus does **NOT** contain B2B financial conversations, invoice disputes, or debt collection communications.
3. **Separate Domain Dataset**: Domain-specific payment conversations are authored and maintained separately under `data/domain/payment_hinglish/` and explicitly marked as `SYNTHETIC / DOMAIN-AUTHORED`.
4. **No Full Corpus Ingestion**: The full multi-gigabyte raw corpus is not bundled into git. Vaada maintains a reference layer with metadata and curated evaluation samples (`data/linguistic/l3cube/samples.json`).

