from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class TaxonomyEntry:
    id: str
    provider: str
    category: str
    payment_method: str | None
    code: str
    reason: str
    description: str
    source: str
    step: str
    official_next_step: str
    official_source_url: str
    source_type: str
    taxonomy_version: str
    retrieved_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _resolve_data_dir() -> Path:
    # 1. Check relative to backend package root (2 levels up from services/razorpay)
    # backend/app/services/razorpay -> backend/app -> backend -> repo root
    repo_root = Path(__file__).resolve().parents[4]
    candidates = [
        repo_root / "data" / "razorpay",
        Path(__file__).resolve().parents[2] / "data" / "razorpay",
        Path("data/razorpay").resolve(),
    ]
    for candidate in candidates:
        if candidate.exists() and (candidate / "taxonomy_metadata.json").exists():
            return candidate
    # Fallback to repo root data/razorpay
    return repo_root / "data" / "razorpay"


class RazorpayTaxonomyService:
    """In-memory, versioned, read-only official Razorpay error taxonomy service."""

    def __init__(self, data_dir: Path | None = None) -> None:
        self.data_dir = data_dir or _resolve_data_dir()
        self._entries: list[TaxonomyEntry] = []
        self._by_id: dict[str, TaxonomyEntry] = {}
        self._by_code_and_reason: dict[tuple[str, str], TaxonomyEntry] = {}
        self._by_method_and_reason: dict[tuple[str, str], TaxonomyEntry] = {}
        self._by_reason: dict[str, list[TaxonomyEntry]] = {}
        self._by_code: dict[str, list[TaxonomyEntry]] = {}
        self._metadata: dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        meta_path = self.data_dir / "taxonomy_metadata.json"
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                self._metadata = json.load(f)

        json_files = sorted(self.data_dir.glob("*.json"))
        for json_file in json_files:
            if json_file.name == "taxonomy_metadata.json":
                continue
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    records = json.load(f)
                    if isinstance(records, list):
                        for rec in records:
                            entry = TaxonomyEntry(
                                id=rec["id"],
                                provider=rec.get("provider", "razorpay"),
                                category=rec.get("category", "payment"),
                                payment_method=rec.get("payment_method"),
                                code=rec["code"],
                                reason=rec["reason"],
                                description=rec.get("description", ""),
                                source=rec.get("source", "customer"),
                                step=rec.get("step", "payment_initiation"),
                                official_next_step=rec.get("official_next_step", ""),
                                official_source_url=rec.get("official_source_url", "https://razorpay.com/docs/errors/"),
                                source_type=rec.get("source_type", "official_documentation"),
                                taxonomy_version=rec.get("taxonomy_version", "2026-09-01"),
                                retrieved_at=rec.get("retrieved_at", "2026-09-01T00:00:00Z"),
                            )
                            self._entries.append(entry)
                            self._by_id[entry.id] = entry
                            self._by_code_and_reason[(entry.code.upper(), entry.reason.lower())] = entry
                            if entry.payment_method:
                                self._by_method_and_reason[(entry.payment_method.lower(), entry.reason.lower())] = entry
                            self._by_reason.setdefault(entry.reason.lower(), []).append(entry)
                            self._by_code.setdefault(entry.code.upper(), []).append(entry)
            except Exception as exc:
                print(f"[RazorpayTaxonomyService] Warning: Failed to load {json_file}: {exc}")

    def get_metadata(self) -> dict[str, Any]:
        return dict(self._metadata)

    def get_all(
        self,
        *,
        payment_method: str | None = None,
        source: str | None = None,
        step: str | None = None,
        category: str | None = None,
        code: str | None = None,
        reason: str | None = None,
    ) -> list[TaxonomyEntry]:
        results = self._entries
        if payment_method:
            pm = payment_method.lower().strip()
            results = [e for e in results if e.payment_method and e.payment_method.lower() == pm]
        if source:
            src = source.lower().strip()
            results = [e for e in results if e.source.lower() == src]
        if step:
            st = step.lower().strip()
            results = [e for e in results if e.step.lower() == st]
        if category:
            cat = category.lower().strip()
            results = [e for e in results if e.category.lower() == cat]
        if code:
            cd = code.upper().strip()
            results = [e for e in results if e.code.upper() == cd]
        if reason:
            rs = reason.lower().strip()
            results = [e for e in results if rs in e.reason.lower()]
        return results

    def get_by_id(self, entry_id: str) -> TaxonomyEntry | None:
        return self._by_id.get(entry_id)

    def lookup(
        self,
        *,
        code: str | None = None,
        reason: str | None = None,
        payment_method: str | None = None,
        source: str | None = None,
        step: str | None = None,
    ) -> TaxonomyEntry | None:
        """
        Deterministic lookup hierarchy:
        1. Exact code + reason
        2. Payment method + reason
        3. Reason match
        4. Exact code match (if specific)
        5. Return None if not in official published taxonomy (zero hallucination).
        """
        clean_code = (code or "").strip().upper()
        clean_reason = (reason or "").strip().lower()
        clean_method = (payment_method or "").strip().lower()

        # 1. Exact code + reason
        if clean_code and clean_reason:
            match = self._by_code_and_reason.get((clean_code, clean_reason))
            if match:
                return match

        # 2. Method + reason
        if clean_method and clean_reason:
            match = self._by_method_and_reason.get((clean_method, clean_reason))
            if match:
                return match

        # 3. Reason exact match
        if clean_reason and clean_reason in self._by_reason:
            candidates = self._by_reason[clean_reason]
            if clean_method:
                for c in candidates:
                    if c.payment_method and c.payment_method.lower() == clean_method:
                        return c
            if source:
                for c in candidates:
                    if c.source.lower() == source.lower().strip():
                        return c
            if candidates:
                return candidates[0]

        # 4. Exact code only (fallback for top-level codes)
        if clean_code and clean_code in self._by_code and not clean_reason:
            candidates = self._by_code[clean_code]
            if candidates:
                return candidates[0]

        return None


@lru_cache(maxsize=1)
def get_taxonomy_service() -> RazorpayTaxonomyService:
    return RazorpayTaxonomyService()
