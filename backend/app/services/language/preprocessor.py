from __future__ import annotations

import re
import unicodedata


class HinglishPreprocessor:
    """Preprocesses and normalizes code-mixed Hindi-English text while preserving
    Roman Hindi syntax, informal spellings, and chat-style expressions.
    """

    # Matches 3 or more repeating characters (e.g. "bhaiiiii" -> "bhai", "plzzz" -> "plz")
    _REPEATING_CHARS_RE = re.compile(r"([a-zA-Z])\1{2,}")

    @classmethod
    def preprocess(cls, text: str | None) -> str:
        if not text:
            return ""

        # 1. Unicode Normalization (NFKC)
        normalized = unicodedata.normalize("NFKC", text)

        # 2. Strip dangerous control characters while preserving standard whitespace and line breaks
        clean_chars = [
            char for char in normalized
            if not unicodedata.category(char).startswith("C") or char in ("\n", "\t", " ")
        ]
        cleaned = "".join(clean_chars)

        # 3. Collapse excessive character repetitions (e.g. "bhaaaaai" -> "bhai", "pleasssse" -> "please")
        cleaned = cls._REPEATING_CHARS_RE.sub(r"\1\1", cleaned)

        # 4. Normalize whitespace (collapse multiple spaces, tabs)
        cleaned = re.sub(r"[ \t]+", " ", cleaned)

        # 5. Trim leading/trailing whitespace
        return cleaned.strip()
