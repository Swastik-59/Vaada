from __future__ import annotations

import urllib.parse
from datetime import datetime
from typing import Any

from app.db.models import Customer, Invoice, RecoveryCase, Tenant


def generate_dynamic_upi_payload(
    tenant: Tenant,
    invoice: Invoice,
    case: RecoveryCase,
    *,
    amount_minor: int | None = None,
) -> dict[str, Any]:
    """Generate dynamic NPCI UPI Intent link and Virtual Account details for instant reconciliation."""
    pay_amount_minor = amount_minor if amount_minor is not None else invoice.amount_minor
    amount_inr = f"{pay_amount_minor / 100.0:.2f}"

    # Clean merchant VPA or standard Virtual UPI handle
    clean_tenant_slug = tenant.slug.replace("-", "").lower()
    merchant_vpa = f"{clean_tenant_slug}.settle@icici"
    merchant_van = f"VAADA{invoice.id[:8].upper()}"

    txn_ref = f"INV{invoice.invoice_number[:12]}_{case.id[:6]}"
    note = f"Payment for {invoice.invoice_number} to {tenant.legal_name}"

    params = {
        "pa": merchant_vpa,
        "pn": tenant.legal_name[:25],
        "am": amount_inr,
        "cu": "INR",
        "tr": txn_ref,
        "tn": note[:40],
    }
    upi_uri = f"upi://pay?{urllib.parse.urlencode(params)}"

    return {
        "vpa": merchant_vpa,
        "van": merchant_van,
        "ifsc": "ICIC0000011",
        "bank_name": "ICICI Bank - Corporate Virtual Accounts",
        "payee_name": tenant.legal_name,
        "amount_inr": float(amount_inr),
        "amount_minor": pay_amount_minor,
        "txn_ref": txn_ref,
        "upi_intent_uri": upi_uri,
        "qr_code_data": upi_uri,
    }


def compose_whatsapp_interactive_payload(
    tenant: Tenant,
    customer: Customer,
    invoice: Invoice,
    case: RecoveryCase,
    *,
    template_type: str = "overdue_reminder",
    interest_minor: int = 0,
) -> dict[str, Any]:
    """Compose Meta WhatsApp Business Cloud API compliant interactive HSM message payload."""
    rupees = invoice.amount_minor / 100.0
    interest_rupees = interest_minor / 100.0
    total_rupees = rupees + interest_rupees

    upi_info = generate_dynamic_upi_payload(tenant, invoice, case)

    if template_type == "statutory_warning":
        header_text = "⚠️ URGENT: MSME Statutory Notice"
        body_text = (
            f"Namaste {customer.display_name},\n\n"
            f"This is an official statutory communication from *{tenant.legal_name}* regarding overdue Invoice *#{invoice.invoice_number}*.\n\n"
            f"• Outstanding Principal: *₹{rupees:,.2f}*\n"
            f"• Statutory 3x RBI Interest: *₹{interest_rupees:,.2f}*\n"
            f"• Total Demand: *₹{total_rupees:,.2f}*\n\n"
            f"Under Section 43B(h) of the Income Tax Act, this delayed sum faces immediate tax deduction disallowance. "
            f"Please discharge the balance via the verified UPI link below to avoid formal MSEFC reporting."
        )
    elif template_type == "t_minus_1_promise":
        header_text = "📅 Tomorrow's Payment Commitment"
        body_text = (
            f"Namaste {customer.display_name},\n\n"
            f"Friendly reminder from *{tenant.legal_name}* regarding your scheduled commitment of *₹{rupees:,.2f}* for tomorrow towards Invoice *#{invoice.invoice_number}*.\n\n"
            f"You can complete this directly using the instant UPI button below."
        )
    else:
        header_text = f"Payment Reminder: {tenant.legal_name}"
        body_text = (
            f"Namaste {customer.display_name},\n\n"
            f"Your invoice *#{invoice.invoice_number}* for *₹{rupees:,.2f}* issued by *{tenant.legal_name}* is overdue.\n\n"
            f"Please click below to pay instantly via UPI or choose an option to confirm your payment schedule."
        )

    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": customer.phone_number or customer.contact_value,
        "type": "interactive",
        "interactive": {
            "type": "button",
            "header": {"type": "text", "text": header_text},
            "body": {"text": body_text},
            "footer": {"text": f"Merchant: {tenant.legal_name} • Powered by Vaada"},
            "action": {
                "buttons": [
                    {
                        "type": "reply",
                        "reply": {
                            "id": f"pay_upi_{invoice.id[:8]}",
                            "title": f"💳 Pay ₹{rupees:,.0f} UPI",
                        },
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": f"promise_date_{invoice.id[:8]}",
                            "title": "📅 Promise Date",
                        },
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": f"dispute_gst_{invoice.id[:8]}",
                            "title": "⚠️ Dispute / TDS",
                        },
                    },
                ]
            },
        },
        "preview_data": {
            "header": header_text,
            "body": body_text,
            "upi_intent_uri": upi_info["upi_intent_uri"],
            "vpa": upi_info["vpa"],
            "van": upi_info["van"],
        },
    }
