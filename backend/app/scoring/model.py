from __future__ import annotations

import math
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression

MODEL_DIR = Path(__file__).resolve().parent / "artifacts"
MODEL_FILE = MODEL_DIR / "recovery_scorer.joblib"

ROOT_CAUSE_CATEGORIES = [
    "insufficient_funds",
    "bank_decline",
    "network_error",
    "customer_dispute",
    "invoice_mismatch",
    "card_expired",
    "mandate_failed",
    "unstructured_text",
    "unknown",
]


def extract_features(
    root_cause: str,
    amount_minor: int,
    days_overdue: int,
    prior_contacts: int,
    day_of_week: int = 0,
) -> np.ndarray:
    """Construct tabular numerical feature vector for tabular ML scoring."""
    cause_idx = (
        ROOT_CAUSE_CATEGORIES.index(root_cause)
        if root_cause in ROOT_CAUSE_CATEGORIES
        else ROOT_CAUSE_CATEGORIES.index("unknown")
    )
    cause_onehot = [1.0 if i == cause_idx else 0.0 for i in range(len(ROOT_CAUSE_CATEGORIES))]
    amount_log = math.log1p(max(amount_minor, 0) / 100.0)  # log of amount in INR
    days_capped = min(max(days_overdue, 0), 180) / 30.0  # overdue in months
    contacts = min(max(prior_contacts, 0), 10)
    dow_norm = (day_of_week % 7) / 6.0

    features = cause_onehot + [amount_log, days_capped, float(contacts), dow_norm]
    return np.array(features, dtype=np.float64)


def train_model() -> dict[str, Any]:
    """Train a calibrated tabular ML model on synthetic training data with ground truth outcomes."""
    rng = np.random.RandomState(42)
    n_samples = 1500

    X_list = []
    y_list = []

    for _ in range(n_samples):
        cause = rng.choice(ROOT_CAUSE_CATEGORIES, p=[0.25, 0.15, 0.15, 0.1, 0.1, 0.05, 0.1, 0.05, 0.05])
        amount = int(rng.exponential(scale=5000000) + 100000)  # INR 1,000 to 500,000
        overdue_days = int(rng.exponential(scale=15))
        prior_contacts = int(rng.poisson(lam=1.5))
        dow = rng.randint(0, 7)

        feats = extract_features(cause, amount, overdue_days, prior_contacts, dow)
        X_list.append(feats)

        # Realistic ground truth probability function
        base_logit = 0.6
        if cause == "network_error":
            base_logit += 0.8
        elif cause == "card_expired":
            base_logit += 0.4
        elif cause == "insufficient_funds":
            base_logit -= 0.3
        elif cause == "customer_dispute":
            base_logit -= 1.2
        elif cause == "bank_decline":
            base_logit -= 0.8

        base_logit -= (overdue_days / 30.0) * 0.5
        base_logit -= (prior_contacts * 0.2)
        base_logit -= (math.log1p(amount / 100.0) / 15.0) * 0.3

        prob = 1.0 / (1.0 + math.exp(-base_logit))
        label = 1 if rng.rand() < prob else 0
        y_list.append(label)

    X = np.array(X_list)
    y = np.array(y_list)

    # 80/20 train/test split
    split_idx = int(n_samples * 0.8)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    base_clf = GradientBoostingClassifier(n_estimators=50, max_depth=3, random_state=42)
    calibrated_clf = CalibratedClassifierCV(estimator=base_clf, method="sigmoid", cv=3)
    calibrated_clf.fit(X_train, y_train)

    y_pred_prob = calibrated_clf.predict_proba(X_test)[:, 1]
    y_pred_binary = (y_pred_prob >= 0.5).astype(int)

    from sklearn.metrics import accuracy_score, brier_score_loss, precision_score, recall_score, roc_auc_score

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred_binary)),
        "precision": float(precision_score(y_test, y_pred_binary, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred_binary, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_pred_prob)),
        "brier_score": float(brier_score_loss(y_test, y_pred_prob)),
        "test_samples": len(y_test),
        "train_samples": len(y_train),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": calibrated_clf, "metrics": metrics}, MODEL_FILE)

    return metrics


def score_recovery_ml(
    *,
    root_cause: str,
    amount_minor: int,
    due_at: datetime,
    now: datetime | None = None,
    prior_contacts: int = 0,
) -> float:
    """Predict calibrated probability of recovery using tabular ML model."""
    now = now or datetime.now(UTC)
    if due_at.tzinfo is None:
        due_at = due_at.replace(tzinfo=UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)

    days_overdue = max((now - due_at).days, 0)
    day_of_week = now.weekday()

    feats = extract_features(root_cause, amount_minor, days_overdue, prior_contacts, day_of_week).reshape(1, -1)

    if not MODEL_FILE.exists():
        train_model()

    try:
        saved = joblib.load(MODEL_FILE)
        model = saved["model"]
        prob = float(model.predict_proba(feats)[0, 1])
    except Exception:
        # Logistic fallback if artifact loading fails
        from app.services.scoring import score_recovery as fallback_score
        prob = fallback_score(
            root_cause=root_cause,
            amount_minor=amount_minor,
            due_at=due_at,
            now=now,
            prior_contacts=prior_contacts,
        )

    return round(min(max(prob, 0.01), 0.99), 5)
