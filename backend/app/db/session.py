from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import Settings

_BACKEND_DIR = Path(__file__).resolve().parents[2]


def _engine_url(settings: Settings):
    if not settings.is_sqlite or ":memory:" in settings.database_url:
        return settings.database_url
    url = make_url(settings.database_url)
    database = url.database
    if not database or database == ":memory:":
        return settings.database_url
    path = Path(database)
    if not path.is_absolute():
        url = url.set(database=str((_BACKEND_DIR / path).resolve()))
    return url


def _migrate_sqlite_columns(engine):
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        with engine.connect() as conn:
            if "customers" in tables:
                cols = [c["name"] for c in inspector.get_columns("customers")]
                if "gstin" not in cols:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN gstin VARCHAR(15)"))
                if "pan" not in cols:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN pan VARCHAR(10)"))
                if "is_msme" not in cols:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN is_msme BOOLEAN DEFAULT 0 NOT NULL"))
                if "msme_category" not in cols:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN msme_category VARCHAR(32)"))
                if "udyam_reg_number" not in cols:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN udyam_reg_number VARCHAR(32)"))
                if "phone_number" not in cols:
                    conn.execute(text("ALTER TABLE customers ADD COLUMN phone_number VARCHAR(20)"))

            if "invoices" in tables:
                cols = [c["name"] for c in inspector.get_columns("invoices")]
                if "e_invoice_irn" not in cols:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN e_invoice_irn VARCHAR(64)"))
                if "tds_rate_percent" not in cols:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN tds_rate_percent NUMERIC(4, 2) DEFAULT 0.0 NOT NULL"))
                if "tds_minor" not in cols:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN tds_minor INTEGER DEFAULT 0 NOT NULL"))
                if "net_payable_minor" not in cols:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN net_payable_minor INTEGER DEFAULT 0 NOT NULL"))
                if "statutory_due_date" not in cols:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN statutory_due_date DATETIME"))
                if "dispute_status" not in cols:
                    conn.execute(text("ALTER TABLE invoices ADD COLUMN dispute_status VARCHAR(32) DEFAULT 'none' NOT NULL"))

            if "recovery_cases" in tables:
                cols = [c["name"] for c in inspector.get_columns("recovery_cases")]
                if "statutory_interest_minor" not in cols:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN statutory_interest_minor INTEGER DEFAULT 0 NOT NULL"))
                if "p2p_broken_count" not in cols:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN p2p_broken_count INTEGER DEFAULT 0 NOT NULL"))
                if "credit_risk_tier" not in cols:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN credit_risk_tier VARCHAR(16) DEFAULT 'MEDIUM' NOT NULL"))
                if "cash_discount_offered_percent" not in cols:
                    conn.execute(text("ALTER TABLE recovery_cases ADD COLUMN cash_discount_offered_percent NUMERIC(4, 2) DEFAULT 0.0 NOT NULL"))

            if "promises_to_pay" in tables:
                cols = [c["name"] for c in inspector.get_columns("promises_to_pay")]
                if "installment_index" not in cols:
                    conn.execute(text("ALTER TABLE promises_to_pay ADD COLUMN installment_index INTEGER DEFAULT 1 NOT NULL"))
                if "total_installments" not in cols:
                    conn.execute(text("ALTER TABLE promises_to_pay ADD COLUMN total_installments INTEGER DEFAULT 1 NOT NULL"))
                if "t_minus_1_sent" not in cols:
                    conn.execute(text("ALTER TABLE promises_to_pay ADD COLUMN t_minus_1_sent BOOLEAN DEFAULT 0 NOT NULL"))
                if "is_broken" not in cols:
                    conn.execute(text("ALTER TABLE promises_to_pay ADD COLUMN is_broken BOOLEAN DEFAULT 0 NOT NULL"))
            conn.commit()
    except Exception:
        pass


def create_engine_from_settings(settings: Settings):
    connect_args = {}
    engine_kwargs: dict = {"future": True}
    url = _engine_url(settings)
    if settings.is_sqlite:
        connect_args["check_same_thread"] = False
        engine_kwargs["connect_args"] = connect_args
        if ":memory:" in settings.database_url:
            engine_kwargs["poolclass"] = StaticPool
    elif connect_args:
        engine_kwargs["connect_args"] = connect_args
    engine = create_engine(url, **engine_kwargs)
    if settings.is_sqlite and ":memory:" not in settings.database_url:
        _migrate_sqlite_columns(engine)
    return engine


def session_factory(engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db_dependency(factory: sessionmaker[Session]):
    def _get_db() -> Generator[Session, None, None]:
        db = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return _get_db

