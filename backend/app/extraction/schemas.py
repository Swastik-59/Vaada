from datetime import date
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PromiseCommitment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: int | None = Field(default=None, ge=0, description="Promised payment amount in minor units (paise/cents)")
    promised_date: date | None = Field(default=None, description="ISO date when payment is promised")
    confidence: float | None = Field(default=None, ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    intent: str | None = Field(default="promise_to_pay", description="Classified customer intent e.g. promise_to_pay, vague_promise, dispute, already_paid, refusal, extension_request, no_commitment")
    commitment_strength: str | None = Field(default="medium", description="Commitment firmness: high, medium, low")
    raw_text: str | None = Field(default=None, max_length=4000, description="Original customer message text")
    language_mix: str | None = Field(default="hinglish", max_length=32, description="Language classification e.g. hinglish, english, hindi_devanagari, roman_hindi")
    hindi_ratio: float | None = Field(default=None, ge=0.0, le=1.0, description="Proportion of Hindi linguistic tokens")
    english_ratio: float | None = Field(default=None, ge=0.0, le=1.0, description="Proportion of English linguistic tokens")
    code_switched: bool | None = Field(default=False, description="True if code-switching was detected")
    hindi_signals: list[str] = Field(default_factory=list, description="Extracted Hindi signal words for explainability")
    english_signals: list[str] = Field(default_factory=list, description="Extracted English signal words for explainability")

    @field_validator("language_mix")
    @classmethod
    def normalize_mix(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip().lower() or None

    @field_validator("intent")
    @classmethod
    def normalize_intent(cls, value: str | None) -> str | None:
        if value is None:
            return "promise_to_pay"
        return value.strip().lower()

    @field_validator("commitment_strength")
    @classmethod
    def normalize_strength(cls, value: str | None) -> str | None:
        if value is None:
            return "medium"
        return value.strip().lower()

