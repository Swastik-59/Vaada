from __future__ import annotations

import os

from fastapi.testclient import TestClient

os.environ.setdefault("VAADA_JWT_SECRET", "test-secret-value-32chars-min")
os.environ.setdefault("VAADA_DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("VAADA_CORS_ORIGINS", "http://localhost:3000")

from app.core.config import get_settings
from app.main import create_app


def test_health_is_live_without_database_access() -> None:
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready_reports_database_dependency_failure(monkeypatch) -> None:
    get_settings.cache_clear()
    app = create_app()
    monkeypatch.setattr("app.main.database_is_ready", lambda engine: False, raising=False)
    client = TestClient(app)

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
