# Model Card: Vaada AI Subsystems

## 1. Subsystem Overview

Vaada uses a multi-tier AI architecture to balance sub-millisecond inference speed, deterministic compliance, and semantic natural language understanding:

```
┌───────────────────────────────────┐     ┌───────────────────────────────────┐     ┌───────────────────────────────────┐
│     TABULAR ML RECOVERY SCORER    │     │      HYBRID LANGUAGE DETECTOR     │     │       LLM PROMISE EXTRACTOR       │
│  • Algorithm: GradientBoosting    │     │  • Lexicon + Script Statistics    │     │  • Local LLM / Deterministic AST  │
│  • Task: Predict P(Recovery)      │     │  • Task: LID & Code-Switching     │     │  • Task: Semantic Intent & Date   │
│  • Latency: < 2 ms                │     │  • Latency: < 1 ms                │     │  • Latency: < 150 ms (or fallback)│
└───────────────────────────────────┘     └───────────────────────────────────┘     └───────────────────────────────────┘
```

---

## 2. Component Details

### A. Tabular Recovery Probability Scorer
- **Model**: `GradientBoostingClassifier` with `CalibratedClassifierCV` (sigmoid calibration).
- **Inputs**: Root cause (categorical), invoice amount (log-transformed minor units), days overdue, prior contact count, day of week.
- **Output**: Calibrated probability $P \in [0.0, 1.0]$.
- **Performance**: ROC-AUC: `0.7215`, Brier Score: `0.2076` on held-out test data.

### B. Hybrid Language Identification Engine (HingLID Production Layer)
- **Model**: Lexicon-informed statistical character & morphological stem analyzer.
- **Inputs**: Normalized customer response text.
- **Outputs**: Language classification (`hinglish`, `english`, `hindi_devanagari`, `roman_hindi`), Hindi/English token ratios, code-switching boolean flag, and extracted signal tokens.
- **Performance**: `95.0%` Language ID accuracy on curated L3Cube academic benchmark.

> [!TIP]
> **Engineering Trade-off Note**:
> Full transformer-based token taggers (e.g. `HingBERT`) require heavy PyTorch / CUDA runtime dependencies (>2 GB memory overhead) and introduce unacceptable request latency (200–500 ms) in real-time webhook endpoints. Vaada's production hybrid LID achieves **<1 ms execution time** with zero external runtime bloat, while preserving strict compatibility with L3Cube benchmark suites.

### C. Promise & Intent Extractor
- **Model**: Local Open-Source LLM (Ollama / Qwen2.5) with deterministic heuristic parser fallback.
- **Inputs**: Untrusted customer message, current date anchor, net invoice balance.
- **Outputs**: `PromiseCommitment` schema (Intent, Promised Date, Amount in minor units, Commitment Strength, Calibrated Confidence).
- **Performance**: `100.0%` intent classification accuracy, `100.0%` precision, `1.0` F1 score on domain test suite.

---

## 3. Limitations & Ethical Safeguards

1. **Untrusted Data Boundary**: Customer messages cannot directly execute financial write-offs or override statutory deadlines.
2. **Ambiguity Fallback**: Ambiguous statements (`"try karunga"`, `"shayad"`) are assigned low confidence and routed to human operators.
3. **Audit Logged**: Every AI decision is recorded as an immutable, tamper-evident audit event.
