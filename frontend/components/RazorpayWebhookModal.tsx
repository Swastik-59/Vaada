"use client";

import React, { useState } from "react";

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultInvoiceNumber?: string;
  onEventProcessed?: () => void;
}

const SCENARIOS = [
  {
    id: "insufficient_funds",
    name: "Payment Failed — Insufficient Funds (UPI)",
    event: "payment.failed",
    description: "Debtor's bank account lacked sufficient funds. Triggers taxonomy diagnosis & initiates recovery workflow.",
    badge: "BAD_REQUEST_ERROR",
    badgeColor: "border-amber-500/30 text-amber-400 bg-amber-500/10",
  },
  {
    id: "payment_successful",
    name: "Payment Captured — Full Remittance (UPI / UTR)",
    event: "payment.captured",
    description: "Debtor completes 100% payment. System auto-reconciles UTR, marks invoice PAID, and transitions case to RECOVERED.",
    badge: "RECOVERED",
    badgeColor: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
  },
  {
    id: "bank_technical_error",
    name: "Gateway Timeout — Core Banking Down",
    event: "payment.failed",
    description: "Acquiring bank switch timed out. Diagnosed as transient bank error — triggers automated silent retry.",
    badge: "GATEWAY_ERROR",
    badgeColor: "border-blue-500/30 text-blue-400 bg-blue-500/10",
  },
  {
    id: "partial_payment",
    name: "Partial Settlement — 50% Paid",
    event: "payment.captured",
    description: "Debtor makes a partial remittance. Deducts balance, updates statutory interest, and maintains open case.",
    badge: "PARTIAL_RECOVERY",
    badgeColor: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10",
  },
];

export function RazorpayWebhookModal({
  isOpen,
  onClose,
  defaultInvoiceNumber,
  onEventProcessed,
}: WebhookModalProps) {
  const [selectedScenario, setSelectedScenario] = useState("insufficient_funds");
  const [invoiceNumber, setInvoiceNumber] = useState(defaultInvoiceNumber || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleDispatch() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Fetch CSRF cookie
      const csrfCookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("vaada_csrf="))
        ?.split("=")[1];

      const res = await fetch("/api/v1/webhooks/simulator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfCookie ? { "X-CSRF-Token": csrfCookie } : {}),
        },
        body: JSON.stringify({
          scenario: selectedScenario,
          invoice_number: invoiceNumber.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      if (onEventProcessed) {
        onEventProcessed();
      }
    } catch (err: any) {
      setError(err.message || "Failed to dispatch webhook");
    } finally {
      setLoading(false);
    }
  }

  const activeScenarioObj = SCENARIOS.find((s) => s.id === selectedScenario);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#0d0f13] border border-[#252c3d] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c2130] bg-[#141820]">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="text-sm font-semibold tracking-wide text-[#e8ecf4] uppercase">
                Razorpay Test Mode Webhook Dispatcher
              </h2>
            </div>
            <p className="text-xs text-[#8a97af] mt-0.5">
              Inject signed HMAC-SHA256 test payment events into the recovery pipeline.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#8a97af] hover:text-white text-lg p-1 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Target Invoice */}
          <div>
            <label className="block text-xs font-medium text-[#8a97af] mb-1.5 uppercase tracking-wider">
              Target Invoice Reference (Optional)
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-SYN-1001 (defaults to active case)"
              className="w-full px-3 py-2 bg-[#07080a] border border-[#252c3d] rounded-md text-sm text-[#e8ecf4] placeholder-[#5c6a85] focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Scenario Selection */}
          <div>
            <label className="block text-xs font-medium text-[#8a97af] mb-2 uppercase tracking-wider">
              Select Payment Event Scenario
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {SCENARIOS.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => setSelectedScenario(sc.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    selectedScenario === sc.id
                      ? "border-amber-500/60 bg-amber-500/5 shadow-inner"
                      : "border-[#1c2130] bg-[#0d0f13] hover:border-[#252c3d]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#e8ecf4]">
                      {sc.name}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${sc.badgeColor}`}
                    >
                      {sc.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#8a97af] mt-1.5 leading-relaxed">
                    {sc.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Result Banner */}
          {result && (
            <div className="p-4 rounded-lg bg-[#141820] border border-emerald-500/40 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <span>✓</span> Webhook Processed Successfully
              </div>
              <div className="text-[#c8d0de] space-y-1">
                <div>Status: <span className="text-amber-400">{result.status}</span></div>
                <div>Invoice: <span className="text-white">{result.simulated_invoice}</span></div>
                {result.case_id && (
                  <div>Recovery Case ID: <span className="text-emerald-400">{result.case_id}</span></div>
                )}
                {result.amount_minor && (
                  <div>Reconciled: ₹{(result.amount_minor / 100).toLocaleString("en-IN")}</div>
                )}
                {result.reference_number && (
                  <div>Bank UTR Reference: <span className="text-cyan-400">{result.reference_number}</span></div>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
              Error: {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1c2130] bg-[#141820]">
          <div className="text-[11px] text-[#5c6a85] font-mono">
            Signed with HMAC-SHA256 secret
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#8a97af] hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDispatch}
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-md shadow transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-3 w-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Dispatching...
                </>
              ) : (
                "Dispatch Webhook Event"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RazorpayWebhookModal;
