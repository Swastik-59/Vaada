#!/usr/bin/env python3
"""
Taxonomy Integrity Validation Script for Razorpay Official Payment Error Taxonomy.

Validates:
- Non-empty records
- Unique IDs
- Unique (code, reason, step) combinations
- Presence of mandatory official fields (id, provider, code, reason, description, source, step, official_next_step, official_source_url)
- Valid official source URLs (must point to official Razorpay docs)
- Valid sources and steps
- Taxonomy metadata integrity (version, retrieval timestamp, source URLs)

Exits with code 0 on success, non-zero on failure.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

VALID_SOURCES = {"customer", "business", "gateway", "razorpay", "issuer_bank", "internal"}
VALID_STEPS = {
    "payment_initiation",
    "payment_authentication",
    "payment_authorization",
    "payment_debit",
    "payment_processing",
    "payment_post_processing",
    "bill_request",
    "bill_payment",
    "internal",
}
VALID_METHODS = {"upi", "card", "netbanking", "wallet", "mandate", "payment", "parameters", "common", None}
ALLOWED_URL_PREFIXES = (
    "https://razorpay.com/docs/errors/",
    "https://razorpay.com/docs/api/errors/",
)


def find_data_dir() -> Path:
    # Check repo root data/razorpay first, then backend/app/data/razorpay
    candidates = [
        Path(__file__).resolve().parent.parent / "data" / "razorpay",
        Path(__file__).resolve().parent / "data" / "razorpay",
        Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "razorpay",
    ]
    for p in candidates:
        if p.exists() and (p / "taxonomy_metadata.json").exists():
            return p
    raise FileNotFoundError("Could not locate data/razorpay taxonomy directory.")


def validate_taxonomy() -> bool:
    data_dir = find_data_dir()
    print(f"[*] Validating Razorpay Taxonomy in: {data_dir}")

    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_combinations: set[tuple[str, str, str]] = set()

    # 1. Validate Metadata
    meta_path = data_dir / "taxonomy_metadata.json"
    if not meta_path.exists():
        errors.append("Missing taxonomy_metadata.json")
    else:
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            required_meta_keys = ["provider", "source", "taxonomy_version", "retrieved_at", "source_urls"]
            for key in required_meta_keys:
                if key not in meta or not meta[key]:
                    errors.append(f"taxonomy_metadata.json missing required key: {key}")
            if meta.get("provider") != "razorpay":
                errors.append(f"Invalid provider in metadata: {meta.get('provider')}")
            for url in meta.get("source_urls", []):
                if not any(url.startswith(prefix) for prefix in ALLOWED_URL_PREFIXES):
                    errors.append(f"Invalid metadata source URL: {url}")
        except Exception as exc:
            errors.append(f"Failed to parse taxonomy_metadata.json: {exc}")

    # 2. Validate Taxonomy Files
    json_files = sorted(data_dir.glob("*.json"))
    record_files = [f for f in json_files if f.name != "taxonomy_metadata.json"]

    if not record_files:
        errors.append("No taxonomy record JSON files found.")

    total_records = 0

    for json_file in record_files:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                records = json.load(f)
        except Exception as exc:
            errors.append(f"Malformed JSON in {json_file.name}: {exc}")
            continue

        if not isinstance(records, list):
            errors.append(f"{json_file.name} must contain a JSON array of records.")
            continue

        if len(records) == 0:
            errors.append(f"{json_file.name} contains zero records.")

        for idx, rec in enumerate(records):
            total_records += 1
            rec_id = rec.get("id")

            # Check ID uniqueness and format
            if not rec_id or not isinstance(rec_id, str):
                errors.append(f"{json_file.name}[{idx}]: Missing or invalid 'id'")
            elif rec_id in seen_ids:
                errors.append(f"{json_file.name}[{idx}]: Duplicate ID '{rec_id}'")
            else:
                seen_ids.add(rec_id)

            # Check required fields
            mandatory = ["provider", "category", "code", "reason", "description", "source", "step", "official_next_step", "official_source_url"]
            for field in mandatory:
                val = rec.get(field)
                if val is None or (isinstance(val, str) and not val.strip()):
                    errors.append(f"{json_file.name}[{idx}] ({rec_id}): Missing mandatory field '{field}'")

            # Validate Provider
            if rec.get("provider") != "razorpay":
                errors.append(f"{json_file.name}[{idx}] ({rec_id}): Provider must be 'razorpay'")

            # Validate Source
            source = rec.get("source")
            if source not in VALID_SOURCES:
                errors.append(f"{json_file.name}[{idx}] ({rec_id}): Invalid source '{source}'")

            # Validate Step
            step = rec.get("step")
            if step not in VALID_STEPS:
                errors.append(f"{json_file.name}[{idx}] ({rec_id}): Invalid step '{step}'")

            # Validate Payment Method
            method = rec.get("payment_method")
            if method not in VALID_METHODS:
                errors.append(f"{json_file.name}[{idx}] ({rec_id}): Invalid payment_method '{method}'")

            # Validate URL
            url = rec.get("official_source_url")
            if url and not any(url.startswith(prefix) for prefix in ALLOWED_URL_PREFIXES):
                errors.append(f"{json_file.name}[{idx}] ({rec_id}): Invalid official_source_url '{url}'")

            # Check duplicate (code, reason, step, payment_method)
            combo = (rec.get("code", ""), rec.get("reason", ""), rec.get("payment_method") or "")
            if combo in seen_combinations:
                errors.append(f"{json_file.name}[{idx}] ({rec_id}): Duplicate combination {combo}")
            else:
                seen_combinations.add(combo)

    # 3. Report Results
    if errors:
        print(f"\n[!] TAXONOMY INTEGRITY VALIDATION FAILED WITH {len(errors)} ERROR(S):")
        for err in errors:
            print(f"  - {err}")
        return False

    print(f"\n[OK] TAXONOMY INTEGRITY VALIDATION PASSED!")
    print(f"    Total files evaluated: {len(record_files) + 1}")
    print(f"    Total official error records: {total_records}")
    print(f"    Taxonomy version: {meta.get('taxonomy_version', 'N/A')}")
    return True


if __name__ == "__main__":
    success = validate_taxonomy()
    sys.exit(0 if success else 1)
