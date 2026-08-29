from __future__ import annotations

from datetime import date
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PromiseCommitment(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: int | None = Field(default=None, ge=0, description="Promised payment amount in minor units (paise/cents)")
    promised_date: date | None = Field(default=None, description="ISO date when payment is promised")
    confidence: float | None = Field(default=None, ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")
    raw_text: str | None = Field(default=None, max_length=4000, description="Original customer message text")
    language_mix: str | None = Field(default=None, max_length=32, description="Language classification e.g. hinglish, english, hindi")

    @field_validator("language_mix")
    @classmethod
    def normalize_mix(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip().lower() or None
