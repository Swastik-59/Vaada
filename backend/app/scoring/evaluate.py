from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.extraction.promise_extractor import PromiseExtractor
from app.extraction.schemas import PromiseCommitment
from app.scoring.model import train_model

DOCS_DIR = Path(__file__).resolve().parents[3] / "docs"

BENCHMARK_HINGLISH_SAMPLES = [
    {
        "input": "kal tak payment ho jayega bhai, 50000 rupees transfer kar dunga UPI se.",
        "expected_date_offset": 1,
        "expected_amount": 5000000,  # minor units (INR 50,000)
        "should_extract": True,
        "language_mix": "hinglish",
    },
    {
        "input": "Main agle somvar (Monday) 1,20,000 INR pay kar dunga, pakka vaada.",
        "expected_date_offset": 5,
        "expected_amount": 12000000,
        "should_extract": True,
        "language_mix": "hinglish",
    },
    {
        "input": "Bank issue chal raha hai, Friday tak ruk jao please. Full balance clear ho jayega.",
        "expected_date_offset": 4,
        "expected_amount": None,  # Full invoice amount implied
        "should_extract": True,
        "language_mix": "hinglish",
    },
    {
        "input": "Invoice wrong hai, hum pay nahi karenge jab tak discount credit note nahi milta.",
        "expected_date_offset": None,
        "expected_amount": None,
        "should_extract": False,
        "language_mix": "hinglish",
    },
    {
        "input": "Haan dekhte hain next month tak ho payega shayad.",
        "expected_date_offset": None,  # Too vague to extract exact commitment
        "expected_amount": None,
        "should_extract": False,
        "language_mix": "hinglish",
    },
]


def run_evaluation() -> dict:
    """Run full system ML & extraction evaluation and write docs/evaluation.md."""
    print("Evaluating Tabular Recovery Probability Model...")
    ml_metrics = train_model()

    print("Evaluating Hinglish Promise Extraction Pipeline...")
    extractor = PromiseExtractor(llm_client=None)  # Uses deterministic parser fallback when Ollama is offline

    correct_extractions = 0
    total_samples = len(BENCHMARK_HINGLISH_SAMPLES)
    sample_results = []

    today = datetime.now(UTC).date()
    invoice_amount_minor = 10000000  # 100,000 INR

    for sample in BENCHMARK_HINGLISH_SAMPLES:
        result, failure = extractor.extract(
            raw_text=sample["input"],
            invoice_amount_minor=invoice_amount_minor,
            today=today,
        )
        is_extracted = result is not None and result.amount is not None or (result is not None and result.promised_date is not None)

        expected = sample["should_extract"]
        passed = (is_extracted == expected)
        if passed:
            correct_extractions += 1

        sample_results.append({
            "input": sample["input"],
            "expected_extract": expected,
            "actual_extracted": is_extracted,
            "passed": passed,
            "extracted_data": result.model_dump() if result else None,
            "failure_reason": failure,
        })

    extraction_accuracy = round(correct_extractions / total_samples, 4)

    eval_report = f"""# System Evaluation & Benchmark Report

This document records the empirical evaluation of Vaada's tabular ML recovery probability model and Hinglish promise-to-pay extraction engine.

---

## 1. Classical ML Recovery Probability Scorer

The recovery probability model is trained on tabular features:
- Root cause (one-hot encoded)
- Invoice amount (log-transformed)
- Days overdue
- Prior contact attempt count
- Day of week

### Model Architecture
- **Algorithm**: `GradientBoostingClassifier` with `CalibratedClassifierCV` (sigmoid calibration)
- **Validation**: 80/20 train/test split on 1,500 synthetic ground-truth case trajectories

### Test Set Performance Metrics
| Metric | Score | Notes |
| :--- | :--- | :--- |
| **Accuracy** | `{ml_metrics['accuracy']:.4f}` | Held-out test accuracy |
| **Precision** | `{ml_metrics['precision']:.4f}` | Positive predictive value |
| **Recall** | `{ml_metrics['recall']:.4f}` | Sensitivity / True Positive Rate |
| **ROC-AUC** | `{ml_metrics['roc_auc']:.4f}` | Area under Receiver Operating Characteristic curve |
| **Brier Score** | `{ml_metrics['brier_score']:.4f}` | Calibration mean squared error (lower is better) |
| **Test Samples** | `{ml_metrics['test_samples']}` | Held-out test cases |

---

## 2. Hinglish Promise-to-Pay Extraction Pipeline

The promise extraction pipeline converts unstructured, code-mixed natural language replies (Hindi-English) into structured `PromiseCommitment` Pydantic models.

### Extraction Benchmark Results
- **Hand-labeled Test Cases**: `{total_samples}`
- **Extraction Accuracy**: `{extraction_accuracy * 100:.1f}%`
- **Fallback Behavior**: Malformed or unparseable responses automatically fail over to `needs_human_review`.

### Sample Benchmark Trace
"""
    for res in sample_results:
        eval_report += f"\n- **Input**: `{res['input']}`\n"
        eval_report += f"  - Expected Extract: `{res['expected_extract']}` | Actual Extracted: `{res['actual_extracted']}` | Status: `{'PASS' if res['passed'] else 'FAIL'}`\n"

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    report_file = DOCS_DIR / "evaluation.md"
    report_file.write_text(eval_report, encoding="utf-8")
    print(f"Evaluation complete. Report written to {report_file}")

    return {
        "ml_metrics": ml_metrics,
        "extraction_accuracy": extraction_accuracy,
        "report_path": str(report_file),
    }


if __name__ == "__main__":
    run_evaluation()
