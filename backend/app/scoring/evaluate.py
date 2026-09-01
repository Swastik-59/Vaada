import json
import sys
from datetime import UTC, datetime
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.scoring.model import train_model
from app.services.language import (
    evaluate_linguistic_benchmark,
    get_l3cube_metadata,
)
from evaluation.hinglish.evaluate_hinglish import run_hinglish_evaluation

DOCS_DIR = Path(__file__).resolve().parents[3] / "docs"


def run_evaluation() -> dict:
    """Run full system ML, linguistic, and domain extraction evaluation and write docs/evaluation.md."""
    print("1/3 Evaluating Tabular Recovery Probability Model...")
    ml_metrics = train_model()

    print("2/3 Evaluating L3Cube Linguistic & Code-Switching Benchmark...")
    print("3/3 Evaluating Payment-Domain Hinglish Extraction Suite...")
    hinglish_eval = run_hinglish_evaluation()

    ling = hinglish_eval["linguistic_benchmark"]
    dom = hinglish_eval["payment_domain_benchmark"]

    eval_report = f"""# System Evaluation & Benchmark Report

This document records the empirical evaluation of Vaada's tabular ML recovery probability model, L3Cube academic linguistic language identification, and domain-specific Hinglish promise-to-pay extraction engine.

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

## 2. Linguistic Foundation: L3Cube-HingCorpus Benchmark

> [!NOTE]
> **Academic Source**: Nayak & Joshi (2022), *L3Cube-HingCorpus and HingBERT*, BSNLP / WILDRE-6 at LREC 2022.
> **Scope**: Academic evaluation of language identification (LID), Roman Hindi morphological signals, and code-switching detection. **Does not contain payment domain data.**

### Linguistic Benchmark Metrics
| Metric | Score | Evaluation Dataset |
| :--- | :--- | :--- |
| **Language ID (LID) Accuracy** | `{ling['lid_accuracy'] * 100:.1f}%` | L3Cube Curated Samples (`{ling['samples_evaluated']}` sentences) |
| **Code-Switching Detection Accuracy** | `{ling['code_switching_accuracy'] * 100:.1f}%` | Real Hindi-English Code-Switched Text |

---

## 3. Payment-Domain Hinglish Promise Extraction Benchmark

> [!IMPORTANT]
> **Dataset**: `data/domain/payment_hinglish/` (Synthetic / Domain-Authored).
> Evaluates structured intent extraction, date parsing, amount resolution, and adversarial robustness across linguistic variations.

### Domain Evaluation Metrics
| Metric | Score | Target Behavior |
| :--- | :--- | :--- |
| **Intent Classification Accuracy** | `{dom['intent_classification_accuracy'] * 100:.1f}%` | Multi-class intent (`promise_to_pay`, `vague`, `dispute`, `refusal`, etc.) |
| **Promise Detection Precision** | `{dom['promise_precision'] * 100:.1f}%` | Avoids false positive promise commitments |
| **Promise Detection Recall** | `{dom['promise_recall'] * 100:.1f}%` | Captures legitimate Hinglish commitments |
| **Promise Detection F1-Score** | `{dom['promise_f1_score']:.4f}` | Harmonic mean of precision and recall |
| **Adversarial Robustness Rate** | `{dom['adversarial_robustness_rate'] * 100:.1f}%` | Safely rejects disputes, vague promises, and prompt injection attacks |

### Domain Sample Benchmark Trace
"""
    for res in dom["details"]:
        status_str = "PASS" if res["passed"] else "FAIL"
        eval_report += f"\n- **Input**: `{res['text']}`\n"
        eval_report += f"  - Intent: `{res['predicted_intent']}` (Gold: `{res['gold_intent']}`) | Extracted Promise: `{res['actual_extracted']}` | Language: `{res['language_mix']}` (Hi: {res['hindi_ratio']}, En: {res['english_ratio']}) | Status: `{status_str}`\n"

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    report_file = DOCS_DIR / "evaluation.md"
    report_file.write_text(eval_report, encoding="utf-8")
    print(f"Evaluation complete. Report written to {report_file}")

    return {
        "ml_metrics": ml_metrics,
        "linguistic_metrics": ling,
        "domain_metrics": dom,
        "report_path": str(report_file),
    }


if __name__ == "__main__":
    run_evaluation()
