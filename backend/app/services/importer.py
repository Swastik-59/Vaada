from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuditEvent, Customer, Invoice, PaymentEvent, RecoveryCase


FORMULA_INJECTION_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def sanitize_csv_cell(value: Any) -> str:
    """
    Sanitize text cell to prevent CSV / Excel formula injection (ASVS V1.2 / CWE-1236).
    If a string begins with dangerous prefix characters, escape with a leading apostrophe.
    """
    if value is None:
        return ""
    raw = str(value)
    if raw.startswith(FORMULA_INJECTION_PREFIXES):
        return "'" + raw
    trimmed = raw.strip()
    if trimmed and trimmed.startswith(FORMULA_INJECTION_PREFIXES):
        return "'" + trimmed
    return trimmed


def parse_amount_to_minor(val_str: str) -> int:
    """
    Parses decimal currency string (e.g. '1500.50', '25,000') into integer paise.
    Throws ValueError if negative, zero, or non-numeric.
    """
    cleaned = re.sub(r"[^\d.-]", "", val_str.strip())
    if not cleaned:
        raise ValueError("Amount is required.")
    try:
        dec = Decimal(cleaned)
    except InvalidOperation:
        raise ValueError(f"Invalid numeric amount '{val_str}'.")
    if dec <= 0:
        raise ValueError("Amount must be greater than zero.")
    # Convert to paise (minor units)
    minor = int((dec * Decimal(100)).quantize(Decimal("1")))
    return minor


def parse_date(date_str: str) -> datetime:
    """
    Parses date strings into timezone-aware UTC datetime.
    Supports YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, and ISO format.
    """
    cleaned = date_str.strip()
    if not cleaned:
        raise ValueError("Date cannot be empty.")

    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.replace(tzinfo=UTC)
        except ValueError:
            continue
    raise ValueError(f"Unrecognized date format '{date_str}'. Expected YYYY-MM-DD or DD/MM/YYYY.")


@dataclass
class ImportResult:
    success: bool
    imported_count: int
    duplicate_count: int
    error_count: int
    errors: list[str] = field(default_factory=list)
    total_amount_minor: int = 0
    created_case_ids: list[str] = field(default_factory=list)


def import_invoices_csv(
    db: Session,
    *,
    tenant_id: str,
    actor_uid: str,
    csv_text: str,
) -> ImportResult:
    """
    Imports commercial receivables from CSV text with full validation,
    CSV formula injection defense, duplicate detection, and audit logging.
    """
    lines = csv_text.strip().splitlines()
    if not lines:
        return ImportResult(
            success=False,
            imported_count=0,
            duplicate_count=0,
            error_count=1,
            errors=["CSV file is empty."],
        )

    # Detect delimiter using sniffer or fallback to comma
    sample = "\n".join(lines[:5])
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel

    reader = csv.DictReader(io.StringIO(csv_text), dialect=dialect)
    if not reader.fieldnames:
        return ImportResult(
            success=False,
            imported_count=0,
            duplicate_count=0,
            error_count=1,
            errors=["Could not parse CSV headers."],
        )

    # Normalize header mapping
    field_map: dict[str, str] = {}
    for col in reader.fieldnames:
        clean = col.strip().lower().replace(" ", "_").replace("-", "_")
        field_map[clean] = col

    def get_val(row: dict[str, str], *aliases: str) -> str | None:
        for alias in aliases:
            if alias in field_map:
                val = row.get(field_map[alias])
                if val is not None and str(val).strip():
                    return str(val).strip()
        return None

    imported_count = 0
    duplicate_count = 0
    errors: list[str] = []
    total_amount_minor = 0
    created_case_ids: list[str] = []
    now = datetime.now(UTC)

    for row_idx, row in enumerate(reader, start=2):  # Row 2 is first data row
        try:
            # 1. Invoice Number (Required)
            inv_no_raw = get_val(row, "invoice_number", "invoice_no", "invoice_id", "inv_num")
            if not inv_no_raw:
                errors.append(f"Row {row_idx}: Missing required invoice number.")
                continue
            inv_number = sanitize_csv_cell(inv_no_raw)

            # Check duplicate within tenant
            existing_inv = db.scalar(
                select(Invoice).where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.invoice_number == inv_number,
                )
            )
            if existing_inv:
                duplicate_count += 1
                continue

            # 2. Customer Name (Required)
            cust_name_raw = get_val(row, "customer_name", "customer", "buyer", "debtor", "company")
            if not cust_name_raw:
                errors.append(f"Row {row_idx}: Missing required customer name.")
                continue
            cust_name = sanitize_csv_cell(cust_name_raw)

            # 3. Amount (Required, positive)
            amt_raw = get_val(row, "amount", "invoice_amount", "total", "balance", "net_amount")
            if not amt_raw:
                errors.append(f"Row {row_idx}: Missing required amount.")
                continue
            amount_minor = parse_amount_to_minor(amt_raw)

            # 4. Due Date (Required)
            due_raw = get_val(row, "due_date", "due_at", "payment_due_date")
            if not due_raw:
                errors.append(f"Row {row_idx}: Missing required due date.")
                continue
            due_at = parse_date(due_raw)

            # 5. Optional Issued Date
            issued_raw = get_val(row, "issued_date", "issued_at", "invoice_date")
            issued_at = parse_date(issued_raw) if issued_raw else (due_at - timedelta(days=30))

            # 6. Optional Contact Info
            contact_val_raw = get_val(row, "contact_value", "phone", "email", "mobile", "contact")
            contact_value = sanitize_csv_cell(contact_val_raw) if contact_val_raw else "billing@customer.local"
            contact_channel = "phone" if re.match(r"^\+?[0-9\s-]{8,15}$", contact_value) else "email"

            # 7. Optional Indian MSME / GSTIN / PAN
            gstin_raw = get_val(row, "gstin", "gst", "gst_no")
            gstin = sanitize_csv_cell(gstin_raw).upper() if gstin_raw else None

            pan_raw = get_val(row, "pan", "pan_no")
            pan = sanitize_csv_cell(pan_raw).upper() if pan_raw else None

            is_msme_raw = get_val(row, "is_msme", "msme")
            is_msme = str(is_msme_raw).lower() in ("true", "1", "yes", "y") if is_msme_raw else False

            msme_category = sanitize_csv_cell(get_val(row, "msme_category", "category")) or ("Small" if is_msme else None)

            # 8. Resolve or create customer
            cust = db.scalar(
                select(Customer).where(
                    Customer.tenant_id == tenant_id,
                    Customer.display_name == cust_name,
                )
            )
            if not cust:
                cust_ext_ref = f"CUST-IMP-{uuid4().hex[:8].upper()}"
                cust = Customer(
                    tenant_id=tenant_id,
                    external_ref=cust_ext_ref,
                    display_name=cust_name,
                    contact_channel=contact_channel,
                    contact_value=contact_value,
                    gstin=gstin,
                    pan=pan,
                    is_msme=is_msme,
                    msme_category=msme_category,
                    phone_number=contact_value if contact_channel == "phone" else None,
                )
                db.add(cust)
                db.flush()

            # 9. Create Invoice
            statutory_due = (issued_at + timedelta(days=45)) if is_msme else None
            invoice = Invoice(
                tenant_id=tenant_id,
                customer_id=cust.id,
                invoice_number=inv_number,
                amount_minor=amount_minor,
                currency="INR",
                issued_at=issued_at,
                due_at=due_at,
                status="overdue",
                statutory_due_date=statutory_due,
                net_payable_minor=amount_minor,
            )
            db.add(invoice)
            db.flush()

            # 10. Create PaymentEvent for failure tracking
            event = PaymentEvent(
                tenant_id=tenant_id,
                source="import_csv",
                provider_event_id=f"evt_imp_{uuid4().hex[:16]}",
                invoice_id=invoice.id,
                customer_id=cust.id,
                event_type="payment.overdue_import",
                payload_json="{\"imported\": true, \"source\": \"csv_upload\"}",
                occurred_at=now,
            )
            db.add(event)
            db.flush()

            # 11. Create RecoveryCase
            recovery_case = RecoveryCase(
                tenant_id=tenant_id,
                invoice_id=invoice.id,
                customer_id=cust.id,
                source_event_id=event.id,
                state="open",
                root_cause="commercial_delinquency",
                classification_method="rule",
                recovery_probability=0.75,
                contact_attempt_count=0,
                version=1,
            )
            db.add(recovery_case)
            db.flush()

            imported_count += 1
            total_amount_minor += amount_minor
            created_case_ids.append(recovery_case.id)

        except ValueError as ve:
            errors.append(f"Row {row_idx}: {str(ve)}")
        except Exception as ex:
            errors.append(f"Row {row_idx}: Unexpected error ({str(ex)})")

    # 12. Record AuditEvent
    if imported_count > 0:
        db.add(
            AuditEvent(
                tenant_id=tenant_id,
                actor_type="user",
                actor_uid=actor_uid,
                action="receivables_imported",
                resource_type="invoice_batch",
                resource_id=f"batch_{now.strftime('%Y%m%d%H%M%S')}",
                payload_json=f'{{"imported_count": {imported_count}, "duplicates": {duplicate_count}, "total_minor": {total_amount_minor}}}',
            )
        )
        db.commit()
    elif duplicate_count > 0:
        db.commit()
    else:
        db.rollback()

    return ImportResult(
        success=imported_count > 0 or (duplicate_count > 0 and len(errors) == 0),
        imported_count=imported_count,
        duplicate_count=duplicate_count,
        error_count=len(errors),
        errors=errors[:50],
        total_amount_minor=total_amount_minor,
        created_case_ids=created_case_ids,
    )


def get_csv_template() -> str:
    """
    Returns standard CSV template with valid Indian enterprise examples.
    """
    return (
        "invoice_number,customer_name,amount,due_date,issued_date,contact_value,gstin,pan,is_msme,msme_category\n"
        "INV-2026-001,Bharat Precision Components Pvt Ltd,285000,2026-08-15,2026-07-01,+919820199881,27AAACB1234F1Z1,AAACB1234F,true,Small\n"
        "INV-2026-002,Deccan Agro Logistics LLP,475000,2026-08-20,2026-07-10,accounts@deccanagro.in,29AABFD4567G1Z4,AABFD4567G,false,\n"
        "INV-2026-003,Kalyan Tooling Solutions,94000,2026-07-28,2026-06-12,+919987012345,27AAHFK7890H1Z8,AAHFK7890H,true,Micro\n"
    )
