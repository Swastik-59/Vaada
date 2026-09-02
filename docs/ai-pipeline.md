# AI Pipeline: Hinglish Understanding, Language Signals & Promise Extraction

## 1. Why Hinglish Matters for Indian B2B Recovery

In Indian B2B trade, accounts receivable communications rarely take place in formal British English or pure literary Devanagari Hindi. Over **75% of merchant-buyer interactions across WhatsApp, SMS, and email occur in Romanized Hindi-English code-mixing (Hinglish)**:

- *"bhai abhi thoda balance issue hai, Friday tak pakka clear kar dunga"* (Colloquial commitment)
- *"kal sham tak 25000 NEFT se transfer ho jayega"* (Split installment promise)
- *"invoice amount galat hai, tax rate pehle check karo"* (Dispute signal)

A recovery system that merely runs English keyword matching or forces machine translation will fatally misclassify colloquial phrases (e.g. translating *"kar dunga"* into an imperative command or ignoring *"try karunga"* vs *"pakka karunga"*).

---

## 2. The Role of L3Cube-HingCorpus & HingLID

### Academic Citation
```
Nayak, Ravindra and Joshi, Raviraj. 2022.
"L3Cube-HingCorpus and HingBERT: A Code Mixed Hindi-English Dataset and BERT Language Models."
In Proceedings of the 9th Workshop on Balto-Slavic Natural Language Processing (BSNLP) / WILDRE-6 at LREC 2022.
```

### What L3Cube Contributes
1. **Linguistic Baseline**: Provides authoritative real-world code-mixed sentences in Roman script.
2. **Language Identification (LID) Calibration**: Empirically validates language detection and code-switching metrics.
3. **Morphological Token Distribution**: Guides the Roman Hindi lexical lexicon for accurate tokenization.

### What L3Cube Does NOT Contribute
- **L3Cube is NOT payment data**: It does not contain debtor communications or invoice payment promises.
- All domain-specific recovery datasets in Vaada are authored separately in `data/domain/payment_hinglish/`.

---

## 3. End-to-End Pipeline Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │           UNTRUSTED INCOMING CUSTOMER MESSAGE          │
 │   "bhai abhi balance nahi hai, Friday tak pakka..."   │
 └──────────────────────────┬─────────────────────────────┘
                            │
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │              HINGLISH PREPROCESSING LAYER              │
 │  • Unicode NFKC Normalization                          │
 │  • Control Character Stripping                         │
 │  • Repetition Collapse ("bhaaaaai" -> "bhai")          │
 │  • Non-Destructive Whitespace Normalization            │
 └──────────────────────────┬─────────────────────────────┘
                            │ Clean Normalized Text
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │          HYBRID LANGUAGE IDENTIFIER & SIGNALS          │
 │  • Devanagari Character Frequency Check                │
 │  • Roman Hindi Lexical Stem Matching                   │
 │  • English Business Token Matching                     │
 │  • Hindi / English Word Ratio Calculation              │
 │  • Code-Switching Detection Flag                       │
 └──────────────────────────┬─────────────────────────────┘
                            │ Preprocessed text + Language Signals
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │        PROMISE EXTRACTION ENGINE (LLM / FALLBACK)      │
 │  • Structured Prompting with Code-Mixed Context        │
 │  • Multi-Class Intent Classification                   │
 │  • Temporal Anchor & Date Offset Resolution            │
 │  • Amount Resolution (Paise Minor Units)               │
 │  • Commitment Strength (High / Medium / Low)           │
 │  • Calibrated Confidence Scoring                       │
 └──────────────────────────┬─────────────────────────────┘
                            │ Validated PromiseCommitment
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │            INVARIANT & SECURITY VALIDATION             │
 │  • Adversarial Prompt Injection Neutralization         │
 │  • Invariant: Amount <= Net Payable Balance            │
 │  • Invariant: Promised Date >= Today                   │
 │  • Low-Confidence / Dispute Routing to Operator Review │
 └────────────────────────────────────────────────────────┘
```

---

## 4. Intent Taxonomy & Uncertainty Handling

| Classified Intent | Description | Sample Utterance | Vaada Recovery Action |
| :--- | :--- | :--- | :--- |
| `promise_to_pay` | Firm commitment with date | *"Friday tak pakka kar dunga"* | Schedule automated follow-up at Promised Date (T-1) |
| `vague_promise` | Ambiguous / non-committal | *"Friday ko try karunga"* | Route to Operator Queue (Low confidence) |
| `dispute` | Invoice error / quality dispute | *"Invoice amount galat hai"* | Mark `DISPUTED`, halt collections, notify finance |
| `already_paid` | Payment claimed completed | *"Already payment kar diya, UTR 998"* | Route to Reconciliation station for UTR verification |
| `refusal` | Explicit unwillingness to pay | *"Hum payment nahi karenge, court jao"* | Escalate to Section 138 NI Act / MSME Samadhaan notice |
| `extension_request` | Liquidity request | *"10 din ka extension chahiye"* | Evaluate cash discount or partial settlement DAG |

---

## 5. Security & Prompt Injection Defense

All customer replies are treated as **untrusted data**:
1. **Isolated Context Boundary**: Inbound text is wrapped in strict delimiters (`---UNTRUSTED_CUSTOMER_MESSAGE_START---`).
2. **System Prompt Immutability**: The LLM is instructed that incoming messages cannot alter statutory policies, cancel debt, or bypass validation rules.
3. **Deterministic Heuristic Shield**: Adversarial strings (e.g. `"ignore previous instructions"`, `"system override"`) are trapped at the pre-execution boundary, marked `no_commitment`, and assigned zero policy influence.
