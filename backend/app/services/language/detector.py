from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any


@dataclass
class LanguageDetectionResult:
    language: str  # "hinglish" | "english" | "hindi_devanagari" | "roman_hindi" | "unknown"
    hindi_ratio: float  # 0.0 to 1.0
    english_ratio: float  # 0.0 to 1.0
    confidence: float  # 0.5 to 1.0
    code_switched: bool  # True if both languages are detected
    hindi_signals: list[str]  # Extracted Hindi words for explainability
    english_signals: list[str]  # Extracted English words for explainability

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LanguageDetector:
    """Hybrid fast language identifier for Indian B2B communications.
    Accurately classifies English, pure Hindi (Devanagari), Roman Hindi, and code-mixed Hinglish.
    """

    # Devanagari Unicode character range
    _DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")

    # Curated Roman Hindi Lexicon & Function Words (drawn from Hindi-English code-mixing frequency lists)
    _ROMAN_HINDI_WORDS = {
        "aap", "aapka", "aapko", "aapke", "aaj", "aata", "aaye", "aayega", "aayenge", "aana",
        "abhi", "agle", "accha", "achha", "apna", "apne", "arrange",
        "baat", "baad", "baaki", "baki", "bahut", "bohot", "bhai", "bhaiya", "bhejo", "bhej", "bhejenge", "bhejunga", "bheja",
        "bilkul", "bol", "bola", "bolo", "bolte", "batao", "bataye",
        "chal", "chala", "chalo", "chahiye", "chhod", "clear",
        "de", "do", "dunga", "denge", "dega", "diya", "dekh", "dekho", "dekhte", "dekhta",
        "gaya", "gayi", "gaye", "galat",
        "hai", "hain", "ho", "hoga", "hogi", "honge", "hua", "hui", "hue", "hona", "hum", "humara", "hume",
        "ja", "jaa", "jao", "jayega", "jayenge", "raha", "rahi", "rahe", "rahenge", "jaata",
        "kab", "kaha", "kahan", "kaise", "kare", "karo", "karenge", "karengy", "karunga", "karwa", "karwaye", "karega", "karte", "karna", "kr", "krunga", "kardo", "kar", "kara", "karegi",
        "kal", "parso", "somvar", "mangalvar", "budhvar", "guruvar", "shukravar", "shanivar", "ravivar",
        "kripya", "kripaya", "kuch", "kya", "kyu", "kyun",
        "lekin", "lena", "liya", "liye", "lo", "loge", "log",
        "mat", "main", "mai", "mera", "meri", "mere", "mujhe", "mujhko",
        "nahi", "nhn", "nhi", "nahin",
        "paise", "paisa", "pakka", "pehle", "par", "pe", "poora", "pura",
        "rokda", "ruk", "ruko",
        "saara", "sab", "sath", "se", "shart", "shayad", "sirf", "soch", "socho", "subah", "shaam", "sham",
        "tak", "tarikh", "tareekh", "thoda", "thodi", "theek", "thik", "tension", "toh", "to", "tum",
        "unka", "unke", "usko", "use",
        "vaada", "vada", "wada", "waqt", "wahi",
        "ye", "yeh", "yaha", "yahan", "yehi",
    }

    # Common English Business & Conversational Lexicon
    _ENGLISH_WORDS = {
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he",
        "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
        "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about",
        "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know",
        "take", "people", "into", "year", "your", "good", "some", "could", "them", "see", "other", "than",
        "then", "now", "look", "only", "come", "its", "over", "think", "also", "back", "after", "use", "two",
        "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any", "these", "give",
        "day", "most", "us", "is", "am", "are", "was", "were", "been", "has", "had",
        # Business/Fintech specific words
        "payment", "pay", "paid", "transfer", "invoice", "balance", "amount", "rupees", "inr", "rs",
        "bank", "account", "accounts", "branch", "neft", "rtgs", "imps", "upi", "cheque", "check",
        "credit", "debit", "discount", "settlement", "settle", "due", "overdue", "receipt", "utr",
        "tomorrow", "yesterday", "today", "morning", "evening", "afternoon", "monday", "tuesday", "wednesday",
        "thursday", "friday", "saturday", "sunday", "week", "month", "next", "full", "part", "partial",
        "dispute", "defective", "wrong", "cancel", "hold", "court", "legal", "notice", "extension", "delay",
        "problem", "issue", "support", "customer", "please", "kindly", "confirmed", "confirm", "done",
    }

    @classmethod
    def detect(cls, text: str | None) -> LanguageDetectionResult:
        if not text or not text.strip():
            return LanguageDetectionResult(
                language="unknown",
                hindi_ratio=0.0,
                english_ratio=0.0,
                confidence=0.5,
                code_switched=False,
                hindi_signals=[],
                english_signals=[],
            )

        # 1. Check for Devanagari script
        devanagari_chars = len(cls._DEVANAGARI_RE.findall(text))
        total_alpha_chars = sum(1 for c in text if c.isalpha())

        if total_alpha_chars > 0 and (devanagari_chars / total_alpha_chars) >= 0.40:
            return LanguageDetectionResult(
                language="hindi_devanagari",
                hindi_ratio=1.0,
                english_ratio=0.0,
                confidence=0.98,
                code_switched=False,
                hindi_signals=[w for w in text.split() if cls._DEVANAGARI_RE.search(w)][:6],
                english_signals=[],
            )

        # 2. Token-level analysis for Roman script
        tokens = re.findall(r"[a-zA-Z]+", text.lower())
        if not tokens:
            return LanguageDetectionResult(
                language="unknown",
                hindi_ratio=0.0,
                english_ratio=0.0,
                confidence=0.5,
                code_switched=False,
                hindi_signals=[],
                english_signals=[],
            )

        hindi_matches: list[str] = []
        english_matches: list[str] = []

        for token in tokens:
            is_hindi = token in cls._ROMAN_HINDI_WORDS
            is_english = token in cls._ENGLISH_WORDS

            if is_hindi and not is_english:
                hindi_matches.append(token)
            elif is_english and not is_hindi:
                english_matches.append(token)
            elif is_hindi and is_english:
                # Disambiguate context-shared words (e.g. "clear", "arrange", "so")
                hindi_matches.append(token)
                english_matches.append(token)

        total_identified = len(hindi_matches) + len(english_matches)
        if total_identified == 0:
            # Fallback to English assumption if standard Latin characters with low signals
            return LanguageDetectionResult(
                language="english",
                hindi_ratio=0.0,
                english_ratio=1.0,
                confidence=0.70,
                code_switched=False,
                hindi_signals=[],
                english_signals=tokens[:5],
            )

        # Calculate lexical signal ratios
        unique_hindi = list(dict.fromkeys(hindi_matches))
        unique_english = list(dict.fromkeys(english_matches))

        hindi_count = len(hindi_matches)
        english_count = len(english_matches)

        hindi_ratio = round(hindi_count / total_identified, 2)
        english_ratio = round(english_count / total_identified, 2)

        # Code-switching classification logic
        code_switched = (hindi_count >= 1 and english_count >= 1)

        if code_switched or (hindi_ratio >= 0.15 and english_ratio >= 0.15):
            detected_lang = "hinglish"
            confidence = min(0.96, 0.75 + (0.05 * min(4, len(unique_hindi) + len(unique_english))))
        elif hindi_ratio > 0.85:
            detected_lang = "roman_hindi"
            confidence = min(0.95, 0.80 + (0.04 * min(3, len(unique_hindi))))
        else:
            detected_lang = "english"
            confidence = min(0.96, 0.80 + (0.04 * min(3, len(unique_english))))

        return LanguageDetectionResult(
            language=detected_lang,
            hindi_ratio=hindi_ratio,
            english_ratio=english_ratio,
            confidence=round(confidence, 2),
            code_switched=code_switched,
            hindi_signals=unique_hindi[:8],
            english_signals=unique_english[:8],
        )
