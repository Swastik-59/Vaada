from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from app.extraction.prompts import EXTRACTION_SYSTEM_PROMPT, format_extraction_user_prompt
from app.extraction.schemas import PromiseCommitment
from app.extraction.validator import validate_extraction_payload
from app.llm.client import LLMClient


class PromiseExtractor:
    def __init__(self, llm_client: LLMClient | None = None, max_retries: int = 2) -> None:
        self.llm_client = llm_client
        self.max_retries = max_retries

    def extract(
        self,
        raw_text: str,
        *,
        invoice_amount_minor: int,
        today: date,
    ) -> tuple[PromiseCommitment | None, str | None]:
        """Extract structured payment commitment from customer response.
        Returns (PromiseCommitment, failure_reason_if_any).
        """
        if self.llm_client is not None and self.llm_client.is_available():
            for attempt in range(self.max_retries + 1):
                try:
                    user_prompt = format_extraction_user_prompt(raw_text, today=today)
                    response_json = self.llm_client.chat_json(
                        system_prompt=EXTRACTION_SYSTEM_PROMPT,
                        user_prompt=user_prompt,
                    )
                    commitment, failure = validate_extraction_payload(
                        response_json,
                        invoice_amount_minor=invoice_amount_minor,
                        today=today,
                        raw_text=raw_text,
                    )
                    if failure is None or failure != "malformed_output":
                        return commitment, failure
                except Exception:
                    if attempt == self.max_retries:
                        break

        # Fallback to robust heuristic Hinglish date/amount parser if LLM is offline or output malformed
        return self._heuristic_fallback(raw_text, invoice_amount_minor=invoice_amount_minor, today=today)

    def _heuristic_fallback(
        self,
        raw_text: str,
        *,
        invoice_amount_minor: int,
        today: date,
    ) -> tuple[PromiseCommitment | None, str | None]:
        text_lower = raw_text.lower()

        # Check for non-commitment / dispute signals
        dispute_keywords = ["dispute", "wrong invoice", "discount", "nahi karenge", "cancel", "fake", "court"]
        if any(kw in text_lower for kw in dispute_keywords):
            return (
                PromiseCommitment(
                    amount=None,
                    promised_date=None,
                    confidence=0.9,
                    raw_text=raw_text,
                    language_mix="hinglish",
                ),
                "dispute_or_refusal_detected",
            )

        # Look for date patterns in Hinglish
        extracted_date: date | None = None

        if any(w in text_lower for w in ["kal", "tomorrow"]):
            extracted_date = today + timedelta(days=1)
        elif any(w in text_lower for w in ["parso", "day after tomorrow"]):
            extracted_date = today + timedelta(days=2)
        elif "next week" in text_lower or "agle hafte" in text_lower:
            extracted_date = today + timedelta(days=7)
        elif "monday" in text_lower or "somvar" in text_lower:
            days_ahead = (0 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif "friday" in text_lower or "shukravar" in text_lower:
            days_ahead = (4 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)

        # Look for amount patterns
        extracted_amount: int | None = None

        # Matches numbers like 50000, 50,000, 1,20,000
        amount_match = re.search(r"(?:rs\.?|inr|rupees|\u20b9)?\s*([0-9]{1,2}(?:,[0-9]{2,3})+|[0-9]{4,7})", text_lower)
        if amount_match:
            clean_num = amount_match.group(1).replace(",", "")
            try:
                extracted_amount = int(clean_num) * 100  # convert to paise
            except ValueError:
                extracted_amount = None
        elif any(w in text_lower for w in ["full balance", "poora", "clear ho jayega", "full payment"]):
            extracted_amount = invoice_amount_minor

        if extracted_date is None and extracted_amount is None:
            return (
                PromiseCommitment(
                    amount=None,
                    promised_date=None,
                    confidence=0.4,
                    raw_text=raw_text,
                    language_mix="hinglish",
                ),
                "vague_response_needs_human_review",
            )

        commitment = PromiseCommitment(
            amount=extracted_amount or invoice_amount_minor,
            promised_date=extracted_date or (today + timedelta(days=3)),
            confidence=0.85,
            raw_text=raw_text,
            language_mix="hinglish",
        )

        return validate_extraction_payload(
            commitment.model_dump(),
            invoice_amount_minor=invoice_amount_minor,
            today=today,
            raw_text=raw_text,
        )
