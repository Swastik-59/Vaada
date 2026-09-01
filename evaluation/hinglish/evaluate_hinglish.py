import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = REPO_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from app.extraction.promise_extractor import PromiseExtractor
from app.services.language import (
    LanguageDetector,
    evaluate_linguistic_benchmark,
    get_l3cube_metadata,
)

DOMAIN_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "domain" / "payment_hinglish"
if not DOMAIN_DATA_DIR.exists():
    DOMAIN_DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "domain" / "payment_hinglish"


def load_domain_test_set() -> list[dict[str, Any]]:
    test_path = DOMAIN_DATA_DIR / "test.jsonl"
    if not test_path.exists():
        return []
    records = []
    with test_path.open("r", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                records.append(json.loads(line))
    return records


def run_hinglish_evaluation() -> dict[str, Any]:
    """Runs linguistic benchmark on L3Cube samples and domain benchmark on payment_hinglish."""
    # 1. Linguistic Benchmark (L3Cube)
    ling_results = evaluate_linguistic_benchmark()
    l3cube_meta = get_l3cube_metadata()

    # 2. Payment-Domain Benchmark
    domain_samples = load_domain_test_set()
    extractor = PromiseExtractor(llm_client=None)  # Uses deterministic linguistic extraction

    today = datetime.now(UTC).date()
    invoice_amount_minor = 10000000  # INR 100,000 benchmark invoice amount

    tp = 0  # True positive: promised and extracted
    fp = 0  # False positive: not promised but extracted
    tn = 0  # True negative: not promised and not extracted
    fn = 0  # False negative: promised but not extracted

    intent_correct = 0
    date_correct = 0
    amount_correct = 0
    adversarial_passed = 0
    total_adversarial = 0

    domain_details = []

    for sample in domain_samples:
        text = sample["text"]
        gold_intent = sample["gold_intent"]
        should_extract = sample["should_extract_promise"]

        is_adversarial = gold_intent in ("no_commitment", "refusal", "dispute", "vague_promise", "already_paid")
        if is_adversarial:
            total_adversarial += 1

        commitment, failure = extractor.extract(
            raw_text=text,
            invoice_amount_minor=invoice_amount_minor,
            today=today,
        )

        extracted = (
            commitment is not None
            and commitment.intent == "promise_to_pay"
            and commitment.promised_date is not None
            and failure is None
        )

        # Confusion matrix
        if should_extract and extracted:
            tp += 1
        elif should_extract and not extracted:
            fn += 1
        elif not should_extract and extracted:
            fp += 1
        else:
            tn += 1

        # Intent evaluation
        pred_intent = commitment.intent if commitment else "no_commitment"
        if pred_intent == gold_intent:
            intent_correct += 1

        # Date evaluation
        if should_extract:
            if commitment and commitment.promised_date:
                date_correct += 1

        # Amount evaluation
        if sample.get("gold_amount") is not None:
            if commitment and commitment.amount == sample["gold_amount"]:
                amount_correct += 1

        # Adversarial check (must NOT extract a firm promise for non-promise cases)
        if is_adversarial:
            if not extracted and failure is not None:
                adversarial_passed += 1

        domain_details.append({
            "id": sample.get("id"),
            "text": text,
            "gold_intent": gold_intent,
            "predicted_intent": pred_intent,
            "gold_extract": should_extract,
            "actual_extracted": extracted,
            "failure_reason": failure,
            "language_mix": commitment.language_mix if commitment else None,
            "hindi_ratio": commitment.hindi_ratio if commitment else None,
            "english_ratio": commitment.english_ratio if commitment else None,
            "passed": (extracted == should_extract) and (pred_intent == gold_intent),
        })

    total_domain = len(domain_samples)
    precision = round(tp / (tp + fp), 4) if (tp + fp) > 0 else 1.0
    recall = round(tp / (tp + fn), 4) if (tp + fn) > 0 else 1.0
    f1 = round(2 * (precision * recall) / (precision + recall), 4) if (precision + recall) > 0 else 0.0
    intent_accuracy = round(intent_correct / total_domain, 4) if total_domain > 0 else 0.0
    adversarial_rate = round(adversarial_passed / total_adversarial, 4) if total_adversarial > 0 else 1.0

    return {
        "linguistic_benchmark": {
            "source": l3cube_meta.get("corpus_name"),
            "citation": l3cube_meta.get("citation"),
            "samples_evaluated": ling_results["total_samples"],
            "lid_accuracy": ling_results["accuracy"],
            "code_switching_accuracy": ling_results["code_switch_accuracy"],
            "details": ling_results["details"],
        },
        "payment_domain_benchmark": {
            "dataset": "payment_hinglish (Synthetic / Domain-Authored)",
            "samples_evaluated": total_domain,
            "intent_classification_accuracy": intent_accuracy,
            "promise_precision": precision,
            "promise_recall": recall,
            "promise_f1_score": f1,
            "adversarial_robustness_rate": adversarial_rate,
            "tp": tp,
            "fp": fp,
            "tn": tn,
            "fn": fn,
            "details": domain_details,
        },
    }
