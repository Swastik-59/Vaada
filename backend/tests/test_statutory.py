from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.db.models import Customer, Invoice, NoticeType, RecoveryCase, Tenant
from app.services.channels import compose_whatsapp_interactive_payload, generate_dynamic_upi_payload
from app.services.p2p import evaluate_case_p2p_adherence
from app.services.statutory import (
    calculate_43b_h_statutory_due_date,
    calculate_msme_statutory_interest,
    generate_statutory_notice_draft,
    get_43b_h_status,
)


def test_43b_h_cutoff_with_and_without_agreement() -> None:
    issued_date = date(2026, 4, 1)
    
    # Written agreement -> max 45 days
    due_with_agreement = calculate_43b_h_statutory_due_date(issued_date, agreement_exists=True)
    assert (due_with_agreement.date() - issued_date).days == 45

    # No written agreement -> max 15 days
    due_without_agreement = calculate_43b_h_statutory_due_date(issued_date, agreement_exists=False)
    assert (due_without_agreement.date() - issued_date).days == 15


def test_msme_statutory_interest_calculation_3x_rbi() -> None:
    issued_dt = datetime(2026, 1, 1, tzinfo=UTC)
    # 45 days statutory cutoff is Feb 15
    # Overdue 60 days past statutory cutoff (total 105 days from issue, approx April 16)
    now_dt = issued_dt + timedelta(days=105)
    amount_minor = 10000000  # ₹100,000 in paise

    interest_minor, overdue_days = calculate_msme_statutory_interest(
        amount_minor,
        issued_at=issued_dt,
        now=now_dt,
        rbi_bank_rate_percent=6.75,
    )

    assert overdue_days == 60
    # Annual rate = 6.75 * 3 = 20.25%. For 2 months compound: ~₹3,400 (340,000 paise)
    assert 300000 <= interest_minor <= 400000


def test_msme_statutory_notice_generation() -> None:
    tenant = Tenant(
        slug="bharat-steel",
        name="Bharat Steel Trading",
        legal_name="Bharat Steel Trading Private Limited",
    )
    customer = Customer(
        external_ref="CUST-001",
        display_name="Kalyani Infrastructure Ltd",
        contact_channel="whatsapp",
        contact_value="+919876543210",
        gstin="27AAACK1234F1Z5",
        pan="AAACK1234F",
        is_msme=True,
        msme_category="Small",
        udyam_reg_number="UDYAM-MH-01-0098765",
    )
    invoice = Invoice(
        invoice_number="INV-2026-0891",
        amount_minor=5000000,  # ₹50,000
        issued_at=datetime(2026, 1, 1, tzinfo=UTC),
        due_at=datetime(2026, 1, 31, tzinfo=UTC),
    )

    draft_43b_h = generate_statutory_notice_draft(
        NoticeType.MSME_43B_H,
        tenant=tenant,
        customer=customer,
        invoice=invoice,
        now=datetime(2026, 4, 1, tzinfo=UTC),
    )

    assert "43B(h)" in draft_43b_h["title"]
    assert "Bharat Steel Trading Private Limited" in draft_43b_h["content_markdown"]
    assert "Kalyani Infrastructure Ltd" in draft_43b_h["content_markdown"]
    assert "UDYAM-MH-01-0098765" in draft_43b_h["content_markdown"]
    assert draft_43b_h["cure_period_days"] == 7

    draft_138 = generate_statutory_notice_draft(
        NoticeType.SEC_138_NI_ACT,
        tenant=tenant,
        customer=customer,
        invoice=invoice,
        now=datetime(2026, 4, 1, tzinfo=UTC),
    )
    assert "Section 138" in draft_138["title"] or "138" in draft_138["title"]
    assert draft_138["cure_period_days"] == 15


def test_dynamic_upi_link_format() -> None:
    tenant = Tenant(
        slug="apex-fabrics",
        name="Apex Fabrics Ltd",
        legal_name="Apex Fabrics Private Limited",
    )
    invoice = Invoice(
        id="a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        invoice_number="INV-2026-440",
        amount_minor=1250000,  # ₹12,500
        issued_at=datetime.now(UTC),
        due_at=datetime.now(UTC),
    )
    case = RecoveryCase(
        id="case-123456",
        tenant_id=tenant.id,
        invoice_id=invoice.id,
        customer_id="cust-1",
        source_event_id="evt-1",
    )

    upi_info = generate_dynamic_upi_payload(tenant, invoice, case)
    assert "upi://pay?" in upi_info["upi_intent_uri"]
    assert "am=12500.00" in upi_info["upi_intent_uri"]
    assert upi_info["vpa"] == "apexfabrics.settle@icici"
    assert "pa=apexfabrics.settle" in upi_info["upi_intent_uri"]
    assert upi_info["van"].startswith("VAADA")



def test_whatsapp_interactive_payload() -> None:
    tenant = Tenant(
        slug="apex-fabrics",
        name="Apex Fabrics Ltd",
        legal_name="Apex Fabrics Private Limited",
    )
    customer = Customer(
        external_ref="CUST-002",
        display_name="Royal Garments",
        contact_channel="whatsapp",
        contact_value="+919820012345",
        phone_number="+919820012345",
    )
    invoice = Invoice(
        id="inv-999",
        invoice_number="INV-2026-999",
        amount_minor=4500000,  # ₹45,000
        issued_at=datetime.now(UTC),
        due_at=datetime.now(UTC),
    )
    case = RecoveryCase(
        id="case-999",
        tenant_id=tenant.id,
        invoice_id=invoice.id,
        customer_id=customer.id,
        source_event_id="evt-999",
    )

    wa_payload = compose_whatsapp_interactive_payload(tenant, customer, invoice, case)
    assert wa_payload["messaging_product"] == "whatsapp"
    assert wa_payload["interactive"]["type"] == "button"
    assert len(wa_payload["interactive"]["action"]["buttons"]) == 3
    assert "₹45,000" in wa_payload["interactive"]["action"]["buttons"][0]["reply"]["title"]
