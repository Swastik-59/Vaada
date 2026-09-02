# Razorpay Official Error Taxonomy Integration Guide

This guide details how Vaada integrates Razorpay's published payment failure taxonomy into its real-time B2B revenue recovery agent architecture.

---

## 1. Architectural Overview

```
                          ┌────────────────────────┐
                          │  Payment Event Stream  │
                          │ (Razorpay / Synthetic) │
                          └───────────┬────────────┘
                                      │
                                      ▼
                        ┌────────────────────────────┐
                        │   Error Normalizer Layer   │
                        │ (app.services.razorpay)    │
                        └─────────────┬──────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
   ┌───────────────────────────┐             ┌───────────────────────────┐
   │ Official Taxonomy Lookup  │             │   Unmapped Error Safe     │
   │   (Local Versioned JSON)  │             │   Fallback (Zero-Halluc)  │
   └─────────────┬─────────────┘             └─────────────┬─────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      ▼
                        ┌────────────────────────────┐
                        │    Policy & Trace Mapper   │
                        │  (Recovery Interpretation) │
                        └─────────────┬──────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
 ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
 │ Audit Logger │              │ State Engine │              │ Frontend UI  │
 │ (audit_event)│              │  (Case DAG)  │              │ (Dual Station│
 └──────────────┘              └──────────────┘              └──────────────┘
```

---

## 2. Directory Layout

```
data/razorpay/
  ├── taxonomy_metadata.json          # Version, citations & provenance manifest
  ├── upi_errors.json                 # 12 official UPI failure records
  ├── payment_errors.json             # 13 official Card/Mandate/Netbanking records
  ├── payment_method_parameters.json  # 6 parameter validation records
  └── common_errors.json              # 7 platform/API error records

backend/app/services/razorpay/
  ├── __init__.py                     # Package exports
  ├── taxonomy.py                     # Singleton in-memory indexed taxonomy service
  ├── normalizer.py                   # Normalizes raw webhook/event payloads
  └── policy_mapper.py                # Maps official errors to derived recovery actions

scripts/
  └── validate_razorpay_taxonomy.py   # Dataset validation tool
```

---

## 3. Lookup Precedence Algorithm

When a payment event is processed, `RazorpayTaxonomyService` resolves the failure through a deterministic, prioritized strategy:

1. **Exact Code + Reason Match**:
   `lookup(code="BAD_REQUEST_ERROR", reason="insufficient_funds")`
2. **Method + Reason Match**:
   `lookup(payment_method="upi", reason="invalid_vpa")`
3. **Reason Match**:
   `lookup(reason="card_declined_by_bank")`
4. **Exact Code Fallback**:
   `lookup(code="GATEWAY_ERROR")`
5. **Unmapped Error Handling**:
   Returns `None`. Normalizer generates:
   ```json
   {
     "matched": false,
     "official": null,
     "derived": {
       "recoverability": "needs_investigation",
       "requires_human_review": true,
       "policy_decision": "ROUTE_TO_OPERATOR_INVESTIGATION",
       "is_unmapped": true
     }
   }
   ```

---

## 4. Transitioning from Synthetic Seeds to Razorpay Test Mode

To connect live Razorpay Test Mode webhooks:

1. **Configure Webhook Endpoint**:
   Direct Razorpay Dashboard webhooks to `POST /api/v1/webhooks/razorpay`.
2. **Signature Verification**:
   Ensure `X-Razorpay-Signature` matches `HMAC-SHA256(payload, RAZORPAY_WEBHOOK_SECRET)`.
3. **Payload Mapping**:
   Razorpay `payment.failed` webhooks provide:
   ```json
   {
     "event": "payment.failed",
     "payload": {
       "payment": {
         "entity": {
           "id": "pay_TEST123",
           "amount": 1850000,
           "currency": "INR",
           "method": "upi",
           "error_code": "BAD_REQUEST_ERROR",
           "error_description": "Payment was declined by customer bank due to insufficient funds.",
           "error_source": "customer",
           "error_step": "payment_debit",
           "error_reason": "insufficient_funds"
         }
       }
     }
   }
   ```
   `normalize_razorpay_error` accepts this raw schema directly without modifications.
