# RAZORPAY OFFICIAL ERROR TAXONOMY INTEGRATION

## Revenue Recovery Agent

You are modifying an existing fintech/AI revenue-recovery application.

The goal of this task is to integrate Razorpay's **official published payment error taxonomy** into the existing system as a first-class, versioned source of payment-failure intelligence.

Do NOT create a fake error-code list.
Do NOT invent Razorpay error codes.
Do NOT replace Razorpay's official terminology with internally invented terminology.
Do NOT scrape Razorpay documentation at runtime.

Razorpay's official documentation is the source of truth.

Official documentation:

1. About Errors
   https://razorpay.com/docs/errors/

2. List of Payment Errors
   https://razorpay.com/docs/errors/payments/list/

3. UPI Error Codes
   https://razorpay.com/docs/errors/payments/upi/

4. Payment Method Error Parameters
   https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/

5. Common Errors
   https://razorpay.com/docs/errors/common/

Use the current contents of those official pages as the source material.

---

# 1. FIRST: INSPECT THE EXISTING PROJECT

Before modifying anything:

1. Inspect the entire repository.
2. Identify:

   * frontend framework
   * backend framework
   * database
   * existing transaction models
   * existing payment/failure models
   * existing AI pipeline
   * existing recovery policy engine
   * existing synthetic dataset
   * existing case detail page
   * existing console
   * existing documentation
3. Find where payment failure information currently enters the system.
4. Find any existing hardcoded error codes.
5. Find any synthetic error taxonomy currently being used.
6. Do not duplicate functionality.
7. Reuse existing models and architecture where appropriate.

Create a short internal implementation plan before editing files.

Do not rewrite unrelated parts of the application.

---

# 2. CORE OBJECTIVE

Integrate Razorpay's published taxonomy into the system so that a payment failure can be represented as:

Razorpay raw error
↓
canonical normalized error
↓
Razorpay taxonomy lookup
↓
recovery interpretation
↓
recovery policy
↓
recommended action

The official Razorpay information must remain distinguishable from our own derived business logic.

For example:

OFFICIAL RAZORPAY DATA

* code
* description
* source
* step
* reason
* payment method
* official next step
* official source URL

OUR DERIVED DATA

* recoverability
* urgency
* retryability
* recommended customer action
* recommended merchant action
* escalation requirement
* preferred communication channel
* policy decision

Never merge these into one ambiguous field.

---

# 3. CREATE A VERSIONED TAXONOMY DATA LAYER

Create:

data/
razorpay/
payment_errors.json
upi_errors.json
payment_method_parameters.json
common_errors.json
taxonomy_metadata.json

If the existing project already has a better data structure, adapt it instead of blindly creating duplicates.

Each official error record should preserve the original Razorpay meaning.

Recommended structure:

{
"id": "stable-internal-id",
"provider": "razorpay",
"category": "payment",
"payment_method": "upi",
"code": "...",
"reason": "...",
"description": "...",
"source": "...",
"step": "...",
"official_next_step": "...",
"official_source_url": "...",
"source_type": "official_documentation",
"taxonomy_version": "YYYY-MM-DD",
"retrieved_at": "YYYY-MM-DDTHH:mm:ssZ"
}

Do not fabricate missing fields.

If Razorpay does not provide a field for a particular error, store null rather than inventing a value.

---

# 4. PRESERVE RAZORPAY'S ORIGINAL FIELDS

Razorpay's documented error response contains fields including:

error.code
error.description
error.field
error.source
error.step
error.reason
error.metadata

The application's normalized error model should support these fields.

Example:

{
"provider": "razorpay",
"raw_code": "BAD_REQUEST_ERROR",
"description": "...",
"field": null,
"source": "customer",
"step": "payment_authentication",
"reason": "invalid_otp",
"metadata": {},
"taxonomy_match": true
}

Do not flatten all of these into a single "failure_reason" string.

The point of the integration is to preserve structured failure information.

---

# 5. BUILD A NORMALIZATION LAYER

Create a dedicated service/module.

Example:

backend/
services/
razorpay/
taxonomy.py
normalizer.py
policy_mapper.py

or use the project's existing architecture.

Create a function/service conceptually equivalent to:

normalize_razorpay_error(raw_error)

Input:

{
"code": "...",
"description": "...",
"source": "...",
"step": "...",
"reason": "...",
"metadata": {}
}

Output:

{
"provider": "razorpay",
"raw": {...},
"taxonomy": {...},
"derived": {...}
}

The raw Razorpay response must remain available for auditing.

---

# 6. TAXONOMY LOOKUP

Implement deterministic lookup before invoking the LLM.

Lookup priority:

1. exact code + reason
2. exact code
3. payment method + reason
4. normalized semantic fallback
5. unknown

Do NOT use the LLM as the primary error-code lookup mechanism.

For example:

payment:
code = BAD_REQUEST_ERROR
source = customer
step = payment_authentication
reason = invalid_otp

should resolve to the corresponding Razorpay taxonomy record.

If no match is found:

taxonomy_match = false

and the system must NOT pretend it knows the official Razorpay interpretation.

The UI should explicitly show:

"Unmapped Razorpay error"

rather than hallucinating an explanation.

---

# 7. DERIVED RECOVERY INTELLIGENCE

After the official taxonomy lookup, create a separate derived layer.

Example:

{
"official": {
"code": "...",
"source": "...",
"step": "...",
"reason": "...",
"description": "...",
"official_next_step": "..."
},

"recovery": {
"recoverability": "recoverable",
"retryable": true,
"urgency": "medium",
"customer_action": "retry_payment",
"merchant_action": "send_retry_prompt",
"requires_human_review": false
}
}

The `recovery` object is OUR product logic.

It must never be presented as an official Razorpay classification.

---

# 8. MAKE THE RECOVERY POLICY ENGINE USE THIS DATA

The existing recovery system currently uses synthetic/fabricated failure reasons.

Replace that dependency with the normalized Razorpay taxonomy wherever appropriate.

Example policy:

IF:
provider = razorpay
taxonomy_match = true
failure is recoverable
customer has not completed payment

THEN:
evaluate customer context
evaluate promise-to-pay state
determine recovery action

The AI should enrich the payment failure context, not replace the payment failure taxonomy.

---

# 9. COMBINE PAYMENT FAILURE + CUSTOMER MESSAGE

This is the actual differentiator of the project.

Example:

Razorpay:

{
"code": "...",
"reason": "insufficient_funds",
"source": "issuer_bank",
"step": "payment_debit"
}

Customer:

"bhai abhi balance nahi hai,
Friday tak pakka kar dunga"

AI extraction:

{
"intent": "promise_to_pay",
"promised_date": "Friday",
"confidence": 0.94
}

The final decision engine should reason over BOTH sources:

payment failure
+
customer intent
+
promise state
+
merchant history
+
current date

Then create:

{
"decision": "WAIT_FOR_PROMISED_DATE",
"reason": "Customer explicitly committed to payment on Friday after an otherwise recoverable payment failure.",
"confidence": 0.91
}

Do not let the LLM invent the Razorpay failure reason.

---

# 10. CREATE A DECISION TRACE

Every recovery recommendation must expose its reasoning.

Example:

PAYMENT FAILURE
↓
Razorpay reason:
insufficient_funds
↓
Source:
issuer_bank
↓
Recoverability:
recoverable
↓
Customer message:
"Friday tak pakka kar dunga"
↓
Promise detected:
YES
↓
Promised date:
Friday
↓
Policy:
WAIT_FOR_PROMISED_DATE
↓
Next action:
SCHEDULE FOLLOW-UP

This must be available in the case detail interface.

---

# 11. BUILD THE RAZORPAY ERROR EXPLORER

Add a section to the Operations Console:

"Razorpay Error Intelligence"

The screen should show real taxonomy data rather than synthetic examples.

Filters:

* payment method
* error category
* source
* step
* reason
* recoverability
* mapped/unmapped

Each row:

CODE
REASON
SOURCE
STEP
DESCRIPTION
OFFICIAL NEXT STEP
RECOVERY POLICY

Clicking a row should open a detailed side panel.

---

# 12. CASE DETAIL INTEGRATION

On an individual recovery case, add a section:

## PAYMENT DIAGNOSIS

Show:

Payment Method
UPI

Razorpay Error
[official code]

Reason
[official reason]

Source
[official source]

Step
[official step]

Official Guidance
[official next step]

Then separately:

## RECOVERY INTERPRETATION

Recoverability
Recoverable

Recommended Action
Wait for promise date

Reason
Customer has explicitly committed to payment.

This visual separation is mandatory.

The judge should immediately understand:

"Razorpay provided the payment diagnosis. Our system adds AI-driven recovery intelligence."

---

# 13. OFFICIAL SOURCE LINKS

Every taxonomy record must retain its source URL.

Example:

official_source_url:
https://razorpay.com/docs/errors/payments/upi/

The UI should expose:

"View Razorpay documentation"

which opens the relevant official page.

Do not create a generic link for every error if a more specific source URL is available.

---

# 14. DATA PROVENANCE

Create or update:

docs/data-provenance.md

Include:

## Razorpay Error Taxonomy

Source:
Razorpay official documentation

URLs:

* https://razorpay.com/docs/errors/
* https://razorpay.com/docs/errors/payments/list/
* https://razorpay.com/docs/errors/payments/upi/
* https://razorpay.com/docs/errors/payments/payment-methods-error-parameters/
* https://razorpay.com/docs/errors/common/

Purpose:

Used as the authoritative payment-failure taxonomy and source for transaction failure interpretation.

Important:

The project must clearly distinguish:

REAL / OFFICIAL
Razorpay published error taxonomy

REAL / OFFICIAL
Razorpay Test Mode behavior

SYNTHETIC
customer identities

SYNTHETIC
merchant identities

SYNTHETIC
transaction amounts

SYNTHETIC
customer conversations

DERIVED
our recovery policies

DERIVED
our risk scores

DERIVED
our AI decisions

---

# 15. TAXONOMY VERSIONING

Do not make the taxonomy an uncontrolled mutable file.

Create metadata:

{
"provider": "razorpay",
"source": "official_documentation",
"retrieved_at": "...",
"taxonomy_version": "...",
"source_urls": [...]
}

The version should be based on retrieval date or an explicit project version.

Example:

razorpay-taxonomy-2026-09-01

This allows the project to explain which version of the published documentation was used during evaluation.

---

# 16. DO NOT SCRAPE AT RUNTIME

Never do:

frontend
→ Razorpay docs
→ scrape page
→ use result

Never make a user request dependent on the availability of Razorpay's documentation website.

Instead:

official documentation
→ local versioned dataset
→ backend lookup

If a future update mechanism is needed, make it an explicit administrative/data-refresh operation.

---

# 17. OPTIONAL TAXONOMY VALIDATION SCRIPT

Create:

scripts/
validate_razorpay_taxonomy.py

It should check:

* duplicate IDs
* duplicate code/reason combinations
* missing provider
* missing source URL
* malformed records
* unsupported payment methods
* empty descriptions
* invalid source values
* invalid step values

The script should exit with a non-zero status if integrity checks fail.

---

# 18. TESTS

Add tests for:

1. exact error lookup
2. code + reason lookup
3. unknown error
4. malformed error
5. missing reason
6. missing source
7. wrong payment method
8. taxonomy version metadata
9. recovery mapping
10. case decision
11. audit logging

Example:

test_razorpay_taxonomy_lookup_success()

test_razorpay_unknown_error()

test_razorpay_recovery_mapping()

test_case_combines_payment_failure_and_promise()

---

# 19. SECURITY

The taxonomy itself is public information.

However:

* never expose API keys
* never put Razorpay secret keys inside taxonomy files
* never send secret metadata to the LLM
* redact customer PII from AI prompts where unnecessary
* validate Razorpay webhook payloads separately
* do not trust client-provided payment status
* do not allow frontend requests to directly mutate official taxonomy data

The official taxonomy is read-only application data.

---

# 20. LLM CONTEXT

When the AI analyzes a case, provide only the normalized relevant taxonomy record.

Example context:

PAYMENT PROVIDER:
Razorpay

PAYMENT METHOD:
UPI

OFFICIAL ERROR:
insufficient_funds

SOURCE:
issuer_bank

STEP:
payment_debit

OFFICIAL DESCRIPTION:
[official description]

OFFICIAL NEXT STEP:
[official next step]

CUSTOMER MESSAGE:
"bhai Friday tak clear kar dunga"

Ask the model to determine customer intent and recovery strategy.

Do NOT ask:

"What does this Razorpay error mean?"

if your backend already knows.

The backend should supply the authoritative interpretation.

---

# 21. UI DESIGN

The taxonomy interface must match the existing brutalist/editorial fintech design system.

Do not create a generic admin table.

Use:

* strong typography
* high information density
* sharp layouts
* technical labels
* restrained motion
* animated state transitions
* clear information hierarchy

Animation should communicate system state.

Example:

ERROR DETECTED
↓
TAXONOMY MATCHED
↓
FAILURE DIAGNOSED
↓
CUSTOMER INTENT ANALYZED
↓
RECOVERY POLICY SELECTED

Use the existing GSAP/Framer architecture.

Do not add decorative animation that makes the dashboard slower.

---

# 22. DEMO SCENARIO

Create at least one end-to-end demonstration using an official Razorpay error scenario.

Example:

Payment:
₹18,500

Method:
UPI

Razorpay failure:
[actual official/test-mode error]

Customer message:

"bhai abhi balance nahi hai,
Friday tak pakka clear kar dunga"

System:

1. receives payment failure
2. matches Razorpay taxonomy
3. shows official diagnosis
4. analyzes customer message
5. detects promise-to-pay
6. extracts promised date
7. evaluates recoverability
8. selects recovery policy
9. generates follow-up
10. records audit event

The case should be fully inspectable.

---

# 23. TEST MODE PREPARATION

Prepare the architecture for actual Razorpay Test Mode integration.

Razorpay officially provides Test Mode payment scenarios, including test UPI identifiers such as:

success@razorpay

failure@razorpay

and test card flows for simulated failures.

Do not use live credentials.

Create an integration boundary:

Razorpay webhook
↓
FastAPI webhook endpoint
↓
signature verification
↓
event normalization
↓
taxonomy lookup
↓
recovery case

The system must be able to accept synthetic events today and real Test Mode events later without changing the AI/recovery architecture.

---

# 24. DO NOT OVERWRITE WORKING FEATURES

This task is an integration task.

Do not:

* redesign the entire frontend
* replace the AI model
* rewrite the authentication system unless required
* remove current synthetic data
* remove working case flows
* break existing demo functionality

Instead introduce Razorpay taxonomy as a higher-quality data source underneath the existing workflow.

Synthetic data can remain for scenarios where no official Razorpay event exists.

---

# 25. DOCUMENTATION

Update:

README.md
docs/architecture.md
docs/ai-pipeline.md
docs/data-provenance.md
docs/razorpay-integration.md
docs/evaluation.md

Document:

* why Razorpay taxonomy is used
* exact official sources
* how the data is represented
* how normalization works
* how recovery policy derives from it
* what is official versus derived
* how Test Mode will connect later
* limitations

---

# 26. FINAL ACCEPTANCE CRITERIA

The task is complete only when all of the following are true:

[ ] Official Razorpay taxonomy is represented in versioned local data

[ ] No fabricated Razorpay error codes are used where official information exists

[ ] Raw Razorpay fields are preserved

[ ] Taxonomy lookup is deterministic

[ ] Unknown errors are handled honestly

[ ] Recovery logic is separate from official Razorpay data

[ ] Case detail shows official diagnosis separately from AI interpretation

[ ] Razorpay source URLs are visible

[ ] Taxonomy explorer exists

[ ] Tests exist

[ ] Data provenance documentation exists

[ ] Existing synthetic scenarios still work

[ ] Architecture can accept Razorpay Test Mode events later

[ ] No secrets are introduced

[ ] No API keys are exposed to the frontend

[ ] No runtime scraping dependency exists

[ ] Existing frontend design system remains intact

[ ] Existing animations and product UX remain intact

[ ] Existing application functionality passes regression testing

After implementation:

1. Run the backend test suite.
2. Run the frontend build.
3. Run lint/type checks.
4. Start the complete application.
5. Use browser automation to test the end-to-end case.
6. Verify the taxonomy explorer.
7. Verify a case showing official Razorpay diagnosis + AI recovery decision.
8. Verify unknown-error behavior.
9. Verify audit logging.
10. Fix all discovered issues before declaring completion.

Do not report completion simply because files were created.

Completion means the feature works end-to-end in the running application.
