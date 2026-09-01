from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.services.language.detector import LanguageDetector

L3CUBE_DIR = Path(__file__).resolve().parents[4] / "data" / "linguistic" / "l3cube"
if not L3CUBE_DIR.exists():
    # Fallback to local path relative to backend root
    L3CUBE_DIR = Path(__file__).resolve().parents[3] / "data" / "linguistic" / "l3cube"


def get_l3cube_metadata() -> dict[str, Any]:
    meta_path = L3CUBE_DIR / "source_metadata.json"
    if meta_path.exists():
        return json.loads(meta_path.read_text(encoding="utf-8"))
    return {
        "corpus_name": "L3Cube-HingCorpus",
        "citation": "Nayak & Joshi, 2022",
        "repository_url": "https://github.com/l3cube-pune/code-mixed-nlp",
    }


def get_l3cube_samples() -> list[dict[str, Any]]:
    samples_path = L3CUBE_DIR / "samples.json"
    if samples_path.exists():
        return json.loads(samples_path.read_text(encoding="utf-8"))
    return []


def evaluate_linguistic_benchmark() -> dict[str, Any]:
    """Evaluates LanguageDetector against the L3Cube academic linguistic samples."""
    samples = get_l3cube_samples()
    if not samples:
        return {"total_samples": 0, "accuracy": 0.0, "details": []}

    correct = 0
    code_switch_correct = 0
    details = []

    for sample in samples:
        detection = LanguageDetector.detect(sample["text"])

        # Compare predicted language category
        pred_lang = detection.language
        gold_lang = sample["gold_language"]

        # If gold is hinglish or roman_hindi, accept both as valid Hindi/Hinglish variants
        is_lang_correct = (
            pred_lang == gold_lang
            or (gold_lang in ("hinglish", "roman_hindi") and pred_lang in ("hinglish", "roman_hindi"))
        )

        if is_lang_correct:
            correct += 1

        is_cs_correct = (detection.code_switched == sample.get("has_code_switching", False))
        if is_cs_correct:
            code_switch_correct += 1

        details.append({
            "id": sample.get("id"),
            "text": sample["text"],
            "gold_language": gold_lang,
            "predicted_language": pred_lang,
            "gold_code_switching": sample.get("has_code_switching"),
            "predicted_code_switching": detection.code_switched,
            "hindi_ratio": detection.hindi_ratio,
            "english_ratio": detection.english_ratio,
            "passed": is_lang_correct,
        })

    accuracy = round(correct / len(samples), 4)
    code_switch_accuracy = round(code_switch_correct / len(samples), 4)

    return {
        "total_samples": len(samples),
        "accuracy": accuracy,
        "code_switch_accuracy": code_switch_accuracy,
        "details": details,
    }
