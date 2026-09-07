import sys
import time
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import create_engine_from_settings


def wait_for_db(max_retries: int = 20, delay: int = 3) -> None:
    settings = get_settings()
    if settings.is_sqlite:
        return
    print("Waiting for database connection...")
    try:
        engine = create_engine_from_settings(settings)
    except Exception as exc:
        print(f"Failed to create engine from settings: {exc}", file=sys.stderr)
        sys.exit(1)

    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("Database connection established successfully.")
            return
        except Exception as exc:
            print(f"Attempt {attempt}/{max_retries}: Database not reachable ({exc}). Retrying in {delay}s...")
            time.sleep(delay)

    print("Database connection failed after maximum retries.", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    wait_for_db()
