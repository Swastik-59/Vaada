from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import DependencyFailed, ValidationFailed


class LLMClient:
    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.settings = settings
        self._transport = transport

    def extract_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        if not self.settings.llm_base_url:
            raise DependencyFailed("LLM is not configured.")
        last_error: Exception | None = None
        for _ in range(self.settings.llm_max_retries + 1):
            try:
                payload = self._complete(system_prompt=system_prompt, user_prompt=user_prompt)
                return self._parse_object(payload)
            except (ValidationFailed, DependencyFailed, httpx.HTTPError, json.JSONDecodeError) as exc:
                last_error = exc
        raise DependencyFailed("LLM did not return a valid structured object.") from last_error

    def _complete(self, *, system_prompt: str, user_prompt: str) -> str:
        url = f"{self.settings.llm_base_url.rstrip('/')}/api/chat"
        body = {
            "model": self.settings.llm_model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        with httpx.Client(timeout=self.settings.llm_timeout_seconds, transport=self._transport) as client:
            response = client.post(url, json=body)
            if response.status_code >= 400:
                raise DependencyFailed("LLM provider returned an error.")
            data = response.json()
        message = data.get("message") or {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise ValidationFailed("LLM response was empty.")
        return content

    def _parse_object(self, raw: str) -> dict[str, Any]:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValidationFailed("LLM output was not a JSON object.")
        return parsed
