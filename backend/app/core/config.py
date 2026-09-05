from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VAADA_",
        # Repo-root .env only. A second backend/.env previously overrode the file
        # operators edit and hashed a different seed password than they typed.
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: Literal["development", "test", "production"] = "development"
    debug: bool = False
    log_level: str = "INFO"

    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: str = "http://localhost:3000"

    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"

    jwt_secret: str = Field(min_length=16)
    jwt_issuer: str = "vaada-local"
    jwt_audience: str = "vaada-ops-console"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    database_url: str = "sqlite+pysqlite:///./vaada.db"

    llm_base_url: str = ""
    llm_model: str = "qwen2.5:7b-instruct"
    llm_timeout_seconds: int = 30
    llm_max_retries: int = 2

    contact_window_start_hour: int = 8
    contact_window_end_hour: int = 19
    max_contacts_per_7_days: int = 3

    seed_admin_email: str = "operator@vaada.local"
    seed_admin_password: str = ""

    pagination_max_limit: int = 100
    event_batch_max: int = 50
    request_body_max_bytes: int = 256_000

    event_source: Literal["synthetic", "razorpay_test"] = "synthetic"
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    demo_mode: bool = False

    @field_validator("jwt_secret")
    @classmethod
    def reject_placeholder_secret(cls, value: str) -> str:
        lowered = value.lower()
        if "replace-with" in lowered or value == "changeme":
            raise ValueError(
                "VAADA_JWT_SECRET is still a placeholder. Copy .env.example to .env "
                "and set a random secret (python -c \"import secrets; print(secrets.token_urlsafe(48))\")."
            )
        return value

    @field_validator("seed_admin_email", "seed_admin_password", mode="before")
    @classmethod
    def strip_seed_credentials(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")



@lru_cache
def get_settings() -> Settings:
    return Settings()
