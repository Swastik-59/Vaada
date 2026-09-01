from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

from app.extraction.prompts import EXTRACTION_SYSTEM_PROMPT, format_extraction_user_prompt
from app.extraction.schemas import PromiseCommitment
from app.extraction.validator import validate_extraction_payload
from app.llm.client import LLMClient
from app.services.language import HinglishPreprocessor, LanguageDetector


class PromiseExtractor:
    """Robust Hindi-English code-mixed promise extraction pipeline.
    Preprocesses raw messages, extracts linguistic signals, and parses payment commitments.
    """

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
        # 1. Preprocess & normalize raw text
        cleaned_text = HinglishPreprocessor.preprocess(raw_text)

        # 2. Run language identification & signal extraction
        lang_result = LanguageDetector.detect(cleaned_text)

        # 3. Try LLM extraction if available
        if self.llm_client is not None and self.llm_client.is_available():
            for attempt in range(self.max_retries + 1):
                try:
                    user_prompt = format_extraction_user_prompt(cleaned_text, today=today)
                    response_json = self.llm_client.chat_json(
                        system_prompt=EXTRACTION_SYSTEM_PROMPT,
                        user_prompt=user_prompt,
                    )
                    # Enrich response with detected linguistic analysis
                    if isinstance(response_json, dict):
                        response_json.setdefault("language_mix", lang_result.language)
                        response_json.setdefault("hindi_ratio", lang_result.hindi_ratio)
                        response_json.setdefault("english_ratio", lang_result.english_ratio)
                        response_json.setdefault("code_switched", lang_result.code_switched)
                        response_json.setdefault("hindi_signals", lang_result.hindi_signals)
                        response_json.setdefault("english_signals", lang_result.english_signals)

                    commitment, failure = validate_extraction_payload(
                        response_json,
                        invoice_amount_minor=invoice_amount_minor,
                        today=today,
                        raw_text=raw_text,
                    )
                    if commitment is not None:
                        commitment.hindi_ratio = lang_result.hindi_ratio
                        commitment.english_ratio = lang_result.english_ratio
                        commitment.code_switched = lang_result.code_switched
                        commitment.hindi_signals = lang_result.hindi_signals
                        commitment.english_signals = lang_result.english_signals

                    if failure is None or failure != "malformed_output":
                        return commitment, failure
                except Exception:
                    if attempt == self.max_retries:
                        break

        # 4. Fallback to robust deterministic linguistic & semantic parser
        return self._heuristic_fallback(
            cleaned_text,
            raw_text=raw_text,
            lang_result=lang_result,
            invoice_amount_minor=invoice_amount_minor,
            today=today,
        )

    def _heuristic_fallback(
        self,
        cleaned_text: str,
        *,
        raw_text: str,
        lang_result: Any,
        invoice_amount_minor: int,
        today: date,
    ) -> tuple[PromiseCommitment | None, str | None]:
        text_lower = cleaned_text.lower()

        base_commitment = PromiseCommitment(
            amount=None,
            promised_date=None,
            confidence=0.90,
            intent="no_commitment",
            commitment_strength="high",
            raw_text=raw_text,
            language_mix=lang_result.language,
            hindi_ratio=lang_result.hindi_ratio,
            english_ratio=lang_result.english_ratio,
            code_switched=lang_result.code_switched,
            hindi_signals=lang_result.hindi_signals,
            english_signals=lang_result.english_signals,
        )

        # 1. Check for prompt injection attacks or adversarial control words
        if any(w in text_lower for w in ["ignore previous", "ignore instructions", "bypass rules", "system override"]):
            base_commitment.intent = "no_commitment"
            base_commitment.confidence = 0.99
            return base_commitment, "adversarial_prompt_injection_blocked"

        # 2. Check for explicit refusal / negative promise
        refusal_patterns = [
            "nahi kar paunga", "nahi kar payenge", "nahi karenge", "nahi bhejenge",
            "refuse", "court jao", "court me milenge", "bilkul paise nahi", "don't call",
        ]
        if any(p in text_lower for p in refusal_patterns):
            base_commitment.intent = "refusal"
            base_commitment.confidence = 0.92
            return base_commitment, "refusal_detected"

        # 3. Check for invoice dispute / tax issue
        dispute_patterns = [
            "dispute", "galat", "wrong invoice", "invoice amount", "credit note",
            "tax rate", "defective", "quality issue", "short supply", "price dispute",
        ]
        if any(p in text_lower for p in dispute_patterns):
            base_commitment.intent = "dispute"
            base_commitment.confidence = 0.94
            return base_commitment, "dispute_detected"

        # 4. Check for already paid claims
        already_paid_patterns = [
            "already", "already payment", "transfer ho chuka", "kar diya hai",
            "transfer kar diya", "utr", "receipt", "paid already",
        ]
        if any(p in text_lower for p in already_paid_patterns):
            base_commitment.intent = "already_paid"
            base_commitment.confidence = 0.93
            return base_commitment, "payment_claimed_already_completed"

        # 5. Check for extension requests
        extension_patterns = [
            "extension", "time do", "thoda time chahiye", "liquidity problem", "cashflow issue",
        ]
        if any(p in text_lower for p in extension_patterns) and not any(d in text_lower for d in ["tak", "ko", "tomorrow", "friday", "monday"]):
            base_commitment.intent = "extension_request"
            base_commitment.commitment_strength = "medium"
            base_commitment.confidence = 0.85
            return base_commitment, "extension_requested"

        # 6. Check for vague / ambiguous commitments
        vague_patterns = [
            "try karunga", "try karenge", "shayad", "dekhte hain", "dekhta hu",
            "not sure", "confirm nahi", "next month tak ho payega shayad",
        ]
        is_vague = any(p in text_lower for p in vague_patterns)

        # 7. Extract Date Patterns
        extracted_date: date | None = None
        if any(w in text_lower for w in ["kal", "tomorrow", "kal tak", "kal sham", "kal subah"]):
            extracted_date = today + timedelta(days=1)
        elif any(w in text_lower for w in ["parso", "day after tomorrow", "parso tak"]):
            extracted_date = today + timedelta(days=2)
        elif any(w in text_lower for w in ["next week", "agle hafte"]):
            extracted_date = today + timedelta(days=7)
        elif any(w in text_lower for w in ["monday", "somvar", "somwar"]):
            days_ahead = (0 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif any(w in text_lower for w in ["tuesday", "mangalvar", "mangalwar"]):
            days_ahead = (1 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif any(w in text_lower for w in ["wednesday", "budhvar", "budhwar"]):
            days_ahead = (2 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif any(w in text_lower for w in ["thursday", "guruvar", "guruwar", "veervar"]):
            days_ahead = (3 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif any(w in text_lower for w in ["friday", "shukravar", "shukrawar", "शुक्रवार"]):
            days_ahead = (4 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif any(w in text_lower for w in ["saturday", "shanivar", "shaniwar"]):
            days_ahead = (5 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)
        elif any(w in text_lower for w in ["sunday", "ravivar", "raviwar"]):
            days_ahead = (6 - today.weekday() + 7) % 7 or 7
            extracted_date = today + timedelta(days=days_ahead)

        # 8. Extract Amount Patterns
        extracted_amount: int | None = None
        amount_match = re.search(r"(?:rs\.?|inr|rupees|\u20b9)?\s*([0-9]{1,2}(?:,[0-9]{2,3})+|[0-9]{4,7})", text_lower)
        if amount_match:
            clean_num = amount_match.group(1).replace(",", "")
            try:
                extracted_amount = int(clean_num) * 100
            except ValueError:
                extracted_amount = None
        elif any(w in text_lower for w in ["full balance", "poora", "pura", "clear ho jayega", "full payment", "poora clear"]):
            extracted_amount = invoice_amount_minor

        # 9. Handle Vague or Missing commitments
        if is_vague:
            base_commitment.intent = "vague_promise"
            base_commitment.promised_date = extracted_date
            base_commitment.amount = extracted_amount
            base_commitment.commitment_strength = "low"
            base_commitment.confidence = 0.55
            return base_commitment, "low_confidence_or_vague"

        if extracted_date is None and extracted_amount is None:
            base_commitment.intent = "no_commitment"
            base_commitment.confidence = 0.40
            return base_commitment, "no_commitment_detected"

        # 10. Firm Promise to Pay
        has_firm_signal = any(w in text_lower for w in ["pakka", "vaada", "vada", "wada", "sure", "confirmed", "definitely", "clear kar dunga", "karwa dunga"])
        strength = "high" if has_firm_signal else "medium"
        confidence = 0.94 if has_firm_signal else 0.88

        commitment = PromiseCommitment(
            amount=extracted_amount or invoice_amount_minor,
            promised_date=extracted_date or (today + timedelta(days=3)),
            confidence=confidence,
            intent="promise_to_pay",
            commitment_strength=strength,
            raw_text=raw_text,
            language_mix=lang_result.language,
            hindi_ratio=lang_result.hindi_ratio,
            english_ratio=lang_result.english_ratio,
            code_switched=lang_result.code_switched,
            hindi_signals=lang_result.hindi_signals,
            english_signals=lang_result.english_signals,
        )

        return validate_extraction_payload(
            commitment.model_dump(),
            invoice_amount_minor=invoice_amount_minor,
            today=today,
            raw_text=raw_text,
        )
