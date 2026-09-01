from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.authz import deps as authz_deps
from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging
from app.core.middleware import (
    BodySizeLimitMiddleware,
    InMemoryRateLimiter,
    OriginCheckMiddleware,
    RateLimitMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
    public_error_payload,
)
from app.db.models import Base
from app.db.session import create_engine_from_settings, get_db_dependency, session_factory


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    engine = create_engine_from_settings(settings)
    Base.metadata.create_all(bind=engine)
    factory = session_factory(engine)
    db_dependency = get_db_dependency(factory)

    app = FastAPI(title="Vaada", version="0.1.0")
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = factory
    app.dependency_overrides[authz_deps.get_db] = db_dependency
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=settings.request_body_max_bytes)
    app.add_middleware(OriginCheckMiddleware, settings=settings)
    app.add_middleware(RateLimitMiddleware, limiter=InMemoryRateLimiter())
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Vaada-Tenant-Id", "X-Request-ID"],
    )
    app.include_router(router, prefix="/api/v1")

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=public_error_payload(request, code=exc.code, message=exc.message, details=exc.details or None),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=public_error_payload(request, code="validation_failed", message="Request validation failed."),
        )

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
