from __future__ import annotations

import inspect
from datetime import UTC, datetime, timedelta

from app.services.scoring import score_recovery

HOLDOUT: list[dict] = [
    {"root_cause": "network_error", "amount_minor": 80_000, "days_overdue": 2, "prior_contacts": 0, "recovered": 1},
    {"root_cause": "insufficient_funds", "amount_minor": 250_000, "days_overdue": 8, "prior_contacts": 1, "recovered": 1},
    {"root_cause": "mandate_failed", "amount_minor": 1_200_000, "days_overdue": 14, "prior_contacts": 2, "recovered": 0},
    {"root_cause": "customer_dispute", "amount_minor": 900_000, "days_overdue": 21, "prior_contacts": 3, "recovered": 0},
    {"root_cause": "invoice_mismatch", "amount_minor": 150_000, "days_overdue": 5, "prior_contacts": 0, "recovered": 1},
    {"root_cause": "bank_decline", "amount_minor": 3_000_000, "days_overdue": 30, "prior_contacts": 2, "recovered": 0},
    {"root_cause": "card_expired", "amount_minor": 60_000, "days_overdue": 4, "prior_contacts": 0, "recovered": 1},
    {"root_cause": "unknown", "amount_minor": 500_000, "days_overdue": 18, "prior_contacts": 1, "recovered": 0},
]


def _score_row(row: dict, now: datetime) -> float:
    due = now - timedelta(days=int(row["days_overdue"]))
    names = inspect.signature(score_recovery).parameters
    kwargs: dict = {}
    mapping = {
        "root_cause": str(row["root_cause"]),
        "failure_reason": str(row["root_cause"]),
        "amount_minor": int(row["amount_minor"]),
        "amount_paise": int(row["amount_minor"]),
        "due_at": due,
        "due_on": due,
        "now": now,
        "scored_at": now,
        "prior_contacts": int(row["prior_contacts"]),
        "previous_contacts": int(row["prior_contacts"]),
    }
    for name in names:
        if name in mapping:
            kwargs[name] = mapping[name]
    return float(score_recovery(**kwargs))


def evaluate_recovery_scorer(*, threshold: float = 0.5) -> dict[str, float]:
    now = datetime.now(UTC)
    scores = [(int(row["recovered"]), _score_row(row, now)) for row in HOLDOUT]
    tp = fp = tn = fn = 0
    for label, probability in scores:
        predicted = 1 if probability >= threshold else 0
        if predicted == 1 and label == 1:
            tp += 1
        elif predicted == 1 and label == 0:
            fp += 1
        elif predicted == 0 and label == 0:
            tn += 1
        else:
            fn += 1
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    accuracy = (tp + tn) / len(scores)
    return {
        "n": float(len(scores)),
        "threshold": threshold,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "accuracy": round(accuracy, 4),
        "true_positives": float(tp),
        "false_positives": float(fp),
    }
