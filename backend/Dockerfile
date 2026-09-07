FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 appuser

COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY backend/app ./app
COPY data ./data

USER appuser
EXPOSE 8000

CMD ["sh", "-c", "python -m app.db.wait && alembic upgrade head && { if [ -n \"$VAADA_SEED_ADMIN_PASSWORD\" ]; then python -m app.seed || true; fi; } && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
