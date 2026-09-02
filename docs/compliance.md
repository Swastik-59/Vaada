# Compliance & Regulatory Guardrails Registry

Vaada encodes India's debt recovery regulatory framework (RBI Fair Practices Code for Regulated Entities & Conduct Instructions for Recovery Agents) as hard, executable software constraints in `app/services/compliance.py`.

A failed guardrail check immediately halts the requested recovery action (`decision = BLOCK`), logs a structured `ComplianceCheck` record, and writes an entry to the append-only audit trail.

---

## Centralized Rules Registry

### 1. Contact Window (`contact_window`)
- **Regulatory Citation**: RBI Master Direction - Fair Practices Code (FPC) for REs / Circular DBOD.No.Leg.BC.75/09.07.005/2007-08 Section 2(v)(a).
- **Rule Description**: Recovery contacts and calls must only be initiated between 08:00 and 19:00 local time (IST), Monday through Saturday. No Sunday or late-night contact is permitted.
- **Executable Logic**:
  ```python
  local_time = now.astimezone(IST)
  passed = time(8, 0) <= local_time.time() < time(19, 0) and local_time.weekday() < 6
  ```
- **Severity**: HARD_STOP (Action blocked, scheduled for next valid window).

---

### 2. Frequency Limiter (`frequency_limit`)
- **Regulatory Citation**: RBI Conduct Guidelines on Harassment & Excessive Contact Attempts.
- **Rule Description**: Cap outbound communications per customer case to a maximum of 3 contact attempts within a rolling 7-day window.
- **Executable Logic**:
  ```python
  used = db.scalar(select(func.count(OutboundCommunication.id)).where(..., created_at >= now - timedelta(days=7)))
  passed = used < settings.max_contacts_per_7_days
  ```
- **Severity**: HARD_STOP (Action blocked, case escalated to human review).

---

### 3. Tone Guardrail (`tone_guardrail`)
- **Regulatory Citation**: RBI FPC Guidelines against Intimidation, Coercion, Abusive Language, or Physical/Verbal Threats.
- **Rule Description**: All AI-drafted messages must be scanned for prohibited coercive or intimidating phrases (e.g. legal threats, police, defamation, arrest, harassment) before marking sendable.
- **Executable Logic**: Deterministic phrase classifier check + LLM-as-judge tone classifier.
- **Severity**: HARD_STOP (Draft rejected, case flagged for operator review).

---

### 4. Third-Party Disclosure Guard (`disclosure_guard`)
- **Regulatory Citation**: RBI Guidelines on Debt Disclosure Privacy & Personal Data Protection Act (DPDP Act 2023).
- **Rule Description**: Debt details, invoice amounts, and default status must NEVER be disclosed to third parties (relatives, neighbors, employees, colleagues).
- **Executable Logic**: Regex and entity filter checking message recipient context. Automated simulation test asserts zero disclosure on third-party replies.
- **Severity**: HARD_STOP (Action blocked immediately).

---

### 5. Identification Requirement (`identity_requirement`)
- **Regulatory Citation**: RBI FPC Section 2(v)(b) - Identification of Recovery Agent / Merchant Entity.
- **Rule Description**: Every outbound recovery communication MUST explicitly state the legal registered name of the merchant entity initiating the contact.
- **Executable Logic**:
  ```python
  passed = merchant_legal_name.lower() in message.lower()
  ```
- **Severity**: HARD_STOP (Message blocked until legal name header is present).
