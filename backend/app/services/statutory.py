from __future__ import annotations

import math
from datetime import UTC, date, datetime, timedelta
from typing import Literal

from app.db.models import Customer, Invoice, NoticeType, Tenant

# Current RBI Bank Rate in India (standard benchmark is ~6.75% per annum)
DEFAULT_RBI_BANK_RATE_PERCENT = 6.75


def calculate_43b_h_statutory_due_date(
    issued_at: datetime | date,
    *,
    agreement_exists: bool = True,
) -> datetime:
    """Calculate the statutory payment cutoff under Section 43B(h) of the Income Tax Act.
    - 45 days if a written commercial agreement exists.
    - 15 days if no written agreement is in place.
    """
    if isinstance(issued_at, date) and not isinstance(issued_at, datetime):
        base_dt = datetime.combine(issued_at, datetime.min.time(), tzinfo=UTC)
    elif issued_at.tzinfo is None:
        base_dt = issued_at.replace(tzinfo=UTC)
    else:
        base_dt = issued_at

    max_days = 45 if agreement_exists else 15
    return base_dt + timedelta(days=max_days)


def calculate_msme_statutory_interest(
    amount_minor: int,
    *,
    issued_at: datetime | date,
    now: datetime | date | None = None,
    agreement_exists: bool = True,
    rbi_bank_rate_percent: float = DEFAULT_RBI_BANK_RATE_PERCENT,
) -> tuple[int, int]:
    """Calculate statutory penal compound interest under Section 16 of the MSMED Act, 2006.
    Rate = 3 x RBI Bank Rate per annum, compounded with monthly rests.
    Returns (interest_minor, overdue_days).
    """
    if now is None:
        now = datetime.now(UTC)

    if isinstance(issued_at, date) and not isinstance(issued_at, datetime):
        issued_dt = datetime.combine(issued_at, datetime.min.time(), tzinfo=UTC)
    elif issued_at.tzinfo is None:
        issued_dt = issued_at.replace(tzinfo=UTC)
    else:
        issued_dt = issued_at

    if isinstance(now, date) and not isinstance(now, datetime):
        now_dt = datetime.combine(now, datetime.min.time(), tzinfo=UTC)
    elif now.tzinfo is None:
        now_dt = now.replace(tzinfo=UTC)
    else:
        now_dt = now

    statutory_due = calculate_43b_h_statutory_due_date(issued_dt, agreement_exists=agreement_exists)

    if now_dt <= statutory_due:
        return 0, 0

    overdue_days = (now_dt - statutory_due).days
    if overdue_days <= 0 or amount_minor <= 0:
        return 0, 0

    # Rate is 3 times the RBI Bank Rate
    annual_rate = (rbi_bank_rate_percent * 3.0) / 100.0
    monthly_rate = annual_rate / 12.0

    # Number of full months and fraction of remaining month
    months = overdue_days / 30.0
    
    # Compound interest formula: A = P * (1 + r)^n - P
    principal = float(amount_minor)
    compound_factor = math.pow(1.0 + monthly_rate, months)
    interest = principal * (compound_factor - 1.0)

    return int(round(interest)), overdue_days


def get_43b_h_status(
    invoice: Invoice,
    customer: Customer,
    now: datetime | None = None,
) -> dict:
    """Evaluate Section 43B(h) compliance status, countdown, and tax disallowance risk."""
    now = now or datetime.now(UTC)
    issued_at = invoice.issued_at if invoice.issued_at.tzinfo else invoice.issued_at.replace(tzinfo=UTC)
    
    statutory_due = invoice.statutory_due_date or calculate_43b_h_statutory_due_date(issued_at, agreement_exists=True)
    days_left = (statutory_due.date() - now.date()).days

    is_disallowed = days_left < 0
    
    interest_minor, overdue_days = calculate_msme_statutory_interest(
        invoice.amount_minor,
        issued_at=issued_at,
        now=now,
    )

    return {
        "is_msme": customer.is_msme or bool(customer.udyam_reg_number),
        "msme_category": customer.msme_category or "Micro",
        "udyam_number": customer.udyam_reg_number or "UDYAM-XX-00-0000000",
        "statutory_due_date": statutory_due.isoformat(),
        "days_remaining": days_left,
        "is_disallowed": is_disallowed,
        "overdue_days": overdue_days,
        "statutory_interest_minor": interest_minor,
        "tax_disallowance_exposure_minor": int(round(invoice.amount_minor * 0.312)),  # ~31.2% corporate tax rate
    }


def generate_statutory_notice_draft(
    notice_type: NoticeType | str,
    *,
    tenant: Tenant,
    customer: Customer,
    invoice: Invoice,
    now: datetime | None = None,
) -> dict:
    """Generate legally compliant statutory notice markdown content and metadata."""
    now = now or datetime.now(UTC)
    date_str = now.strftime("%d %B %Y")
    rupees_principal = invoice.amount_minor / 100.0
    interest_minor, overdue_days = calculate_msme_statutory_interest(
        invoice.amount_minor,
        issued_at=invoice.issued_at,
        now=now,
    )
    rupees_interest = interest_minor / 100.0
    total_claim = (invoice.amount_minor + interest_minor) / 100.0

    udyam_ref = customer.udyam_reg_number or "Registered Enterprise"

    if notice_type == NoticeType.MSME_43B_H or notice_type == "msme_43b_h":
        title = f"STATUTORY TAX ADVISORY: Immediate Compliance Notice u/s 43B(h) — Inv #{invoice.invoice_number}"
        statutory_ref = "Section 43B(h), Income Tax Act, 1961 read with Section 15 of MSMED Act, 2006"
        cure_days = 7
        body = f"""# FORMAL STATUTORY NOTICE: SECTION 43B(h) COMPLIANCE
**Date:** {date_str}  
**To:** The Principal Officer / Accounts Department  
**Entity:** {customer.display_name}  
**GSTIN:** {customer.gstin or "UNREGISTERED / UNPROVIDED"}  
**PAN:** {customer.pan or "UNPROVIDED"}  

**From:** {tenant.legal_name}  
**MSME Registration / Udyam:** {udyam_ref}  

---

### SUBJECT: URGENT COMPLIANCE NOTICE FOR OVERDUE INVOICE #{invoice.invoice_number} AND TAX DEDUCTION DISALLOWANCE UNDER SECTION 43B(h)

Dear Sir / Madam,

1. We refer to our tax invoice **#{invoice.invoice_number}** dated **{invoice.issued_at.strftime('%d/%m/%Y')}** for the principal sum of **INR {rupees_principal:,.2f}**, delivered and accepted by your organization.

2. As a registered MSME unit under the Micro, Small and Medium Enterprises Development Act, 2006 (MSMED Act), we bring to your immediate attention the statutory provisions of **Section 43B(h) of the Income-tax Act, 1961**, inserted vide the Finance Act, 2023.

3. Under Section 43B(h), any sum payable to a Micro or Small enterprise beyond the statutory time limit specified under Section 15 of the MSMED Act (maximum 45 days) **shall not be allowed as a tax-deductible expenditure** for your financial year unless actually paid.

4. As of {date_str}, this invoice is **{overdue_days} days past the statutory limit**. Consequently:
   - **Outstanding Principal:** INR {rupees_principal:,.2f}
   - **Statutory Compound Penal Interest (3x RBI Bank Rate u/s 16 MSMED Act):** INR {rupees_interest:,.2f}
   - **Total Demand:** **INR {total_claim:,.2f}**

5. **DEMAND FOR IMMEDIATE DISCHARGE:**  
   You are hereby called upon to remit the total outstanding balance within **{cure_days} days** of receipt of this notice. Failure to do so will result in formal reporting of this default on the **MSME Samadhaan (MSEFC) Portal** and sharing of non-compliance records with statutory auditors.

Yours faithfully,  
**Authorized Signatory**  
{tenant.legal_name}
"""
    elif notice_type == NoticeType.SEC_138_NI_ACT or notice_type == "sec_138_ni_act":
        title = f"LEGAL DEMAND NOTICE u/s 138 of Negotiable Instruments Act — Inv #{invoice.invoice_number}"
        statutory_ref = "Section 138 & 142 of Negotiable Instruments Act, 1881 / Section 25 Payment and Settlement Systems Act"
        cure_days = 15
        body = f"""# FORMAL LEGAL DEMAND NOTICE
*(Under Section 138 of the Negotiable Instruments Act, 1881 / Section 25 of Payment and Settlement Systems Act, 2007)*

**Date:** {date_str}  
**To:** {customer.display_name}  
**Attention:** Directors / Partners / Proprietor / Authorized Signatory  
**Address / Channel:** {customer.contact_value}  

**From:** {tenant.legal_name}  

---

### RE: STATUTORY DEMAND FOR DISCHARGE OF RETURNED MANDATE / CHEQUE FOR INVOICE #{invoice.invoice_number}

Under instructions from our client **{tenant.legal_name}**, we serve you with this formal statutory notice:

1. That in discharge of your legally enforceable debt towards supply of goods/services against Tax Invoice **#{invoice.invoice_number}**, payment was scheduled for the sum of **INR {rupees_principal:,.2f}**.

2. That the electronic mandate / cheque presented towards payment was dishonoured and returned unpaid with bank remarks indicating failure (*Insufficient Funds / Mandate Stopped / Bank Decline*).

3. That by virtue of said dishonour, an offence has been committed under **Section 138 of the Negotiable Instruments Act, 1881** and **Section 25 of the Payment and Settlement Systems Act, 2007**.

4. **DEMAND:**  
   You are hereby called upon to pay the full sum of **INR {rupees_principal:,.2f}** within a period of **15 (fifteen) days** from the receipt of this notice, failing which our client shall initiate appropriate criminal proceedings against you and all officers responsible for conduct of business.

**Authorized Legal Representative**  
For {tenant.legal_name}
"""
    elif notice_type == NoticeType.MSME_SAMADHAAN_FORM_1 or notice_type == "msme_samadhaan_form_1":
        title = f"PRE-CONCILIATION DISPUTE NOTICE (MSME Samadhaan Form 1) — Inv #{invoice.invoice_number}"
        statutory_ref = "Sections 15, 16, 17 & 18 of MSMED Act, 2006 (MSEFC Conciliation & Arbitration)"
        cure_days = 15
        body = f"""# MSME SAMADHAAN PRE-FILING STATUTORY NOTICE
*(Under Sections 17 & 18 of the Micro, Small and Medium Enterprises Development Act, 2006)*

**Date:** {date_str}  
**To Buyer:** {customer.display_name} (GSTIN: {customer.gstin or 'N/A'})  
**From Supplier:** {tenant.legal_name} (Udyam: {udyam_ref})  

---

### SUBJECT: FINAL PRE-FILING OPPORTUNITY FOR CONCILIATION OF OVERDUE CLAIM #{invoice.invoice_number}

Take notice that:
1. The Buyer has failed to discharge payment for goods/services supplied under Invoice #{invoice.invoice_number} dated {invoice.issued_at.strftime('%d/%m/%Y')}.
2. As per Section 16 of the MSMED Act, buyer is liable to pay compound interest with monthly rests at 3 times the RBI Bank rate from the appointed day.
3. Total Principal: **INR {rupees_principal:,.2f}**  
   Accumulated Compound Interest: **INR {rupees_interest:,.2f}**  
   **Total Payable:** **INR {total_claim:,.2f}**
4. Notice is hereby given that upon expiry of **15 days**, application will be registered before the **Micro and Small Enterprises Facilitation Council (MSEFC)** for conciliation, arbitration, and recovery as arrears of land revenue.

**Authorized Signatory**  
{tenant.legal_name}
"""
    else:
        title = f"Statement of Account & Ledger Confirmation — Inv #{invoice.invoice_number}"
        statutory_ref = "Indian Contract Act, 1872 / Commercial Trade Usage"
        cure_days = 7
        body = f"""# STATEMENT OF OVERDUE ACCOUNT
**Date:** {date_str}  
**Account:** {customer.display_name}  
**Invoice Reference:** #{invoice.invoice_number}  
**Principal Overdue:** INR {rupees_principal:,.2f}  
**Accrued Interest:** INR {rupees_interest:,.2f}  
**Net Claim:** INR {total_claim:,.2f}  

Please confirm payment scheduling or submit proof of remittance within 7 days.
"""

    return {
        "notice_type": str(notice_type),
        "title": title,
        "recipient_name": customer.display_name,
        "recipient_contact": customer.contact_value,
        "statutory_reference": statutory_ref,
        "content_markdown": body,
        "claim_amount_minor": invoice.amount_minor,
        "statutory_interest_minor": interest_minor,
        "cure_period_days": cure_days,
    }
