"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import styles from "./case.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

type RuleResult = {
  rule_id: string;
  title: string;
  passed: boolean;
  detail: string;
};

type ComplianceCheck = {
  action_type: string;
  decision: string;
  failed_rule_ids: string;
  results_json: string;
  created_at: string | null;
};

type Transition = {
  from_state: string;
  to_state: string;
  reason: string;
  actor_type: string;
  score: number | null;
  created_at: string | null;
};

type Promise_ = {
  amount_minor: number;
  promised_date: string;
  confidence: number;
  status: string;
  extraction_failure: string | null;
  raw_text: string;
  language_mix: string;
  t_minus_1_sent?: boolean;
  is_broken?: boolean;
};

type AuditItem = {
  action: string;
  actor_type: string;
  actor_id: string | null;
  payload_json: string;
  created_at: string | null;
};

type StatutoryNotice = {
  id: string;
  notice_type: string;
  title: string;
  statutory_reference: string;
  claim_amount_minor: number;
  statutory_interest_minor: number;
  cure_period_days: number;
  content_markdown: string;
  status: string;
  created_at: string | null;
};

type PaymentReconciliation = {
  id: string;
  reconciliation_type: string;
  amount_minor: number;
  reference_number: string;
  reconciled_by: string;
  created_at: string | null;
};

type CaseData = {
  id: string;
  state: string;
  root_cause: string | null;
  classification_method: string | null;
  recovery_probability: number | null;
  invoice_number: string | null;
  amount_minor: number | null;
  net_payable_minor: number | null;
  currency: string | null;
  due_at: string | null;
  contact_attempt_count: number;
  version: number;
  credit_risk_tier?: string;
  p2p_broken_count?: number;
  statutory_interest_minor?: number;
  customer: {
    id: string | null;
    display_name: string;
    contact_channel: string;
    contact_value: string;
    phone_number?: string | null;
    gstin?: string | null;
    pan?: string | null;
    is_msme: boolean;
    msme_category?: string | null;
    udyam_reg_number?: string | null;
  } | null;
  invoice: {
    id: string | null;
    invoice_number: string | null;
    amount_minor: number | null;
    tds_minor: number;
    tds_rate_percent: number;
    net_payable_minor: number | null;
    e_invoice_irn?: string | null;
    dispute_status: string;
    issued_at: string | null;
    due_at: string | null;
    status: string;
  } | null;
  statutory_status?: {
    is_msme: boolean;
    msme_category?: string;
    udyam_number?: string;
    statutory_due_date: string;
    days_remaining: number;
    is_disallowed: boolean;
    overdue_days?: number;
    statutory_interest_minor: number;
    interest_rate_percent: number;
    tax_disallowance_exposure_minor?: number;
  } | null;
  payment_diagnosis?: {
    matched: boolean;
    provider: string;
    code: string;
    reason: string;
    source: string;
    step: string;
    payment_method: string | null;
    description: string;
    official_next_step: string;
    official_source_url: string;
    raw_payload: any;
  } | null;
  recovery_interpretation?: {
    recoverability: string;
    retryable: boolean;
    urgency: string;
    customer_action?: string;
    merchant_action?: string;
    policy_decision: string;
    requires_human_review: boolean;
    confidence: number;
    is_unmapped: boolean;
  } | null;
  decision_chain?: Array<{
    stage: string;
    label: string;
    details: string;
  }>;
  language_analysis?: {
    raw_text: string;
    language: string;
    hindi_ratio: number;
    english_ratio: number;
    code_switched: boolean;
    confidence: number;
    hindi_signals: string[];
    english_signals: string[];
    intent: string;
    commitment_strength: string;
  } | null;
  upi_payload?: {
    vpa: string;
    van: string;
    ifsc: string;
    bank_name: string;
    payee_name: string;
    amount_inr: number;
    upi_intent_uri: string;
  } | null;
  whatsapp_payload?: {
    preview_data: {
      header: string;
      body: string;
      upi_intent_uri: string;
      vpa: string;
      van: string;
    };
  } | null;
  notices: StatutoryNotice[];
  reconciliations: PaymentReconciliation[];
  event: {
    source: string;
    provider_event_id: string;
    event_type: string;
    occurred_at: string;
    payload_json: string;
  } | null;
  decision_trace: Transition[];
  compliance: ComplianceCheck[];
  promises: Promise_[];
  audit: AuditItem[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return "₹" + Math.round(minor / 100).toLocaleString("en-IN");
}

const TERMINAL_STATES = new Set(["recovered", "unrecoverable", "cancelled"]);
const CAN_SEND_REMINDER = new Set(["awaiting_action", "awaiting_response"]);

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [reason, setReason] = useState("Operator intervention in recovery lifecycle.");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Views & Modals
  const [activeTab, setActiveTab] = useState<"dossier" | "notices" | "reconcile" | "audit">("dossier");
  const [diagTab, setDiagTab] = useState<"official" | "policy" | "raw">("official");
  const [showNoticeGen, setShowNoticeGen] = useState(false);
  const [noticeType, setNoticeType] = useState("msme_43b_h");
  const [showTDSModal, setShowTDSModal] = useState(false);
  const [tdsRate, setTdsRate] = useState("2.0");
  const [form16aAck, setForm16aAck] = useState("ACK-2026-Q4-0098");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payUtr, setPayUtr] = useState("UTR" + Math.floor(1000000000 + Math.random() * 9000000000));
  const [copiedUpi, setCopiedUpi] = useState(false);

  async function loadCase() {
    try {
      const payload = await apiFetch(`/api/v1/cases/${params.id}`);
      setData(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
        setIsUnauthorized(true);
      } else {
        setError(msg);
      }
    }
  }

  useEffect(() => {
    loadCase();
  }, [params.id]);

  async function act(action: string) {
    if (!data) return;
    setActionError("");
    setActionSuccess("");
    setBusy(action);
    try {
      const payload = await apiFetch(`/api/v1/cases/${params.id}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, reason, expected_version: data.version }),
      });
      setData(payload.case);
      setActionSuccess(`Action ${action.toUpperCase()} successfully applied.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateStatutoryNotice() {
    if (!data) return;
    setActionError("");
    setActionSuccess("");
    setBusy("generate_notice");
    try {
      const res = await apiFetch(`/api/v1/cases/${params.id}/notices/generate`, {
        method: "POST",
        body: JSON.stringify({ notice_type: noticeType }),
      });
      setData(res.case);
      setShowNoticeGen(false);
      setActionSuccess(`Statutory notice generated: ${noticeType.toUpperCase()}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Notice generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitTDSReconcile() {
    if (!data) return;
    setActionError("");
    setActionSuccess("");
    setBusy("reconcile_tds");
    try {
      const res = await apiFetch(`/api/v1/cases/${params.id}/reconciliation/tds`, {
        method: "POST",
        body: JSON.stringify({
          tds_rate_percent: parseFloat(tdsRate),
          form_16a_ack: form16aAck,
        }),
      });
      setData(res.case);
      setShowTDSModal(false);
      setActionSuccess("TDS reconciled. Net recoverable balance updated.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "TDS reconciliation failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitPaymentReconcile() {
    if (!data) return;
    setActionError("");
    setActionSuccess("");
    setBusy("reconcile_payment");
    try {
      const amountPaise = Math.round(parseFloat(payAmount || "0") * 100);
      const res = await apiFetch(`/api/v1/cases/${params.id}/reconciliation/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount_minor: amountPaise,
          reconciliation_type: "bank_utr",
          reference_number: payUtr,
        }),
      });
      setData(res.case);
      setShowPaymentModal(false);
      setActionSuccess("Bank remittance matched and ledger reconciled.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Payment recording failed");
    } finally {
      setBusy(null);
    }
  }

  async function checkPromiseAdherence() {
    if (!data) return;
    setBusy("check_adherence");
    try {
      const res = await apiFetch(`/api/v1/cases/${params.id}/p2p/check-adherence`, {
        method: "POST",
      });
      setData(res.case);
      setActionSuccess("Promise adherence evaluated against bank records.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Adherence check failed");
    } finally {
      setBusy(null);
    }
  }

  if (isUnauthorized) {
    return (
      <div className={styles.shell}>
        <div className={styles.authNoticeBanner}>
          <div>
            <strong>Operator Authentication Required.</strong> Please log in to inspect this case dossier.
          </div>
          <Link href="/login" className={styles.signInBtn}>
            Sign In to Console →
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <div className={styles.errorBanner}>
          <span>Notice: {error}</span>
          <Link href="/queue" className={styles.backLink}>
            Return to Queue
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingState}>
          INITIALIZING DOSSIER TELEMETRY...
        </div>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATES.has(data.state);
  const canRemind = CAN_SEND_REMINDER.has(data.state);
  const prob = data.recovery_probability;
  const probPct = prob !== null ? Math.round(prob * 100) : null;
  const probColor =
    probPct !== null
      ? probPct >= 65
        ? "var(--color-recovered)"
        : probPct >= 40
        ? "var(--color-warning)"
        : "var(--color-disallowed)"
      : "var(--text-muted)";

  const stat = data.statutory_status;
  const latestPromise = data.promises.length > 0 ? data.promises[data.promises.length - 1] : null;
  const lang = data.language_analysis;

  return (
    <div className={styles.shell}>
      {/* ── Top Console Nav ── */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/queue" className={styles.navBackLink}>
            ← QUEUE
          </Link>
          <span className={styles.navDivider}>/</span>
          <span className={styles.navDossierId}>CASE {data.id.slice(0, 8)}...</span>
          <span className={styles.navDivider}>/</span>
          <span className={styles.navInvoice}>{data.invoice_number ?? "UNKNOWN INVOICE"}</span>
        </div>
        <div className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${activeTab === "dossier" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("dossier")}
          >
            Investigation Dossier
          </button>
          <button
            className={`${styles.navTab} ${activeTab === "notices" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("notices")}
          >
            Statutory Notices ({data.notices.length})
          </button>
          <button
            className={`${styles.navTab} ${activeTab === "reconcile" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("reconcile")}
          >
            Reconciliation ({data.reconciliations.length})
          </button>
          <button
            className={`${styles.navTab} ${activeTab === "audit" ? styles.navTabActive : ""}`}
            onClick={() => setActiveTab("audit")}
          >
            Audit Trail ({data.audit.length})
          </button>
        </div>
      </nav>

      {/* ── Financial Context & Statutory Clock ── */}
      <section className={styles.telemetryBar}>
        <div className={styles.telemetryCard}>
          <span className={styles.telemetryLabel}>PRINCIPAL RECEIVABLE</span>
          <div className={styles.telemetryPrincipal}>{formatCurrency(data.amount_minor)}</div>
          {data.net_payable_minor && data.net_payable_minor !== data.amount_minor && (
            <div className={styles.telemetrySub}>
              Net Payable (Post-TDS): <strong>{formatCurrency(data.net_payable_minor)}</strong>
            </div>
          )}
        </div>

        <div className={styles.telemetryCard}>
          <span className={styles.telemetryLabel}>MSME SECTION 43B(H) CLOCK</span>
          {stat && stat.is_msme ? (
            <div>
              <div
                className={styles.statDays}
                style={{
                  color: stat.is_disallowed
                    ? "var(--color-disallowed)"
                    : stat.days_remaining <= 5
                    ? "var(--accent)"
                    : "var(--color-warning)",
                }}
              >
                {stat.is_disallowed ? "DISALLOWED" : `${stat.days_remaining} DAYS REMAINING`}
              </div>
              <div className={styles.telemetrySub}>
                Due: {fmtDate(stat.statutory_due_date)} · Tax Exposure:{" "}
                <strong>
                  {formatCurrency(
                    stat.tax_disallowance_exposure_minor ??
                      Math.round((data.amount_minor || 0) * 0.312)
                  )}
                </strong>
              </div>
            </div>
          ) : (
            <div>
              <div className={styles.statDays} style={{ color: "var(--text-muted)" }}>
                NON-MSME DEBTOR
              </div>
              <div className={styles.telemetrySub}>Standard commercial limitation applies</div>
            </div>
          )}
        </div>

        <div className={styles.telemetryCard}>
          <span className={styles.telemetryLabel}>3× RBI BANK RATE PENAL INTEREST</span>
          <div className={styles.statDays}>
            {formatCurrency(data.statutory_interest_minor ?? stat?.statutory_interest_minor ?? 0)}
          </div>
          <div className={styles.telemetrySub}>
            MSMED Act Sec 16 · Monthly rests @ {stat?.interest_rate_percent ?? 20.25}%
          </div>
        </div>

        <div className={styles.telemetryCard}>
          <span className={styles.telemetryLabel}>RECOVERY PROBABILITY</span>
          <div className={styles.probRow}>
            <span className={styles.probVal} style={{ color: probColor }}>
              {probPct !== null ? `${probPct}%` : "—"}
            </span>
            <span className={styles.riskBadge}>{data.credit_risk_tier ?? "TIER 2"}</span>
          </div>
          <div className={styles.probTrack}>
            <div
              className={styles.probFill}
              style={{ width: `${probPct ?? 0}%`, backgroundColor: probColor }}
            />
          </div>
        </div>
      </section>

      {/* Action Banners */}
      {actionSuccess && (
        <div className={styles.successBanner}>
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className={styles.actionErrorBanner}>
          {actionError}
        </div>
      )}

      {/* ── Main Layout: Stream + Operator Deck ── */}
      <div className={styles.mainSplit}>
        {/* Left: Investigation Stream */}
        <main className={styles.investigationStream}>
          {activeTab === "dossier" && (
            <div className={styles.streamStack}>
              {/* STATION 01: Tax Registry & Ingestion */}
              <article className={styles.evidenceNode}>
                <div className={styles.nodeHead}>
                  <div className={styles.nodeIndex}>01</div>
                  <div>
                    <h3 className={styles.nodeTitle}>Event Ingestion & Tax Registry</h3>
                    <span className={styles.nodeMeta}>
                      Source: {data.event?.source ?? "razorpay_webhook"} · Provider Event ID:{" "}
                      {data.event?.provider_event_id ?? "evt_live_01"}
                    </span>
                  </div>
                  <span className={styles.nodeTag}>INGEST</span>
                </div>

                <div className={styles.nodeBody}>
                  <div className={styles.specGrid}>
                    <div className={styles.specItem}>
                      <span className={styles.specKey}>Enterprise Buyer</span>
                      <span className={styles.specVal}>{data.customer?.display_name ?? "—"}</span>
                    </div>
                    <div className={styles.specItem}>
                      <span className={styles.specKey}>GSTIN</span>
                      <span className={styles.specVal} style={{ color: "var(--accent)" }}>
                        {data.customer?.gstin ?? "UNREGISTERED"}
                      </span>
                    </div>
                    <div className={styles.specItem}>
                      <span className={styles.specKey}>MSME Status</span>
                      <span className={styles.specVal}>
                        {data.customer?.is_msme
                          ? `Registered (${data.customer.msme_category ?? "Micro"})`
                          : "Non-MSME"}
                      </span>
                    </div>
                    <div className={styles.specItem}>
                      <span className={styles.specKey}>Udyam Registration</span>
                      <span className={styles.specVal}>{data.customer?.udyam_reg_number ?? "—"}</span>
                    </div>
                    <div className={styles.specItem}>
                      <span className={styles.specKey}>E-Invoice IRN</span>
                      <span className={styles.specValMono}>
                        {data.invoice?.e_invoice_irn ?? "—"}
                      </span>
                    </div>
                    <div className={styles.specItem}>
                      <span className={styles.specKey}>Dispute / Deduction</span>
                      <span className={styles.specVal}>
                        {data.invoice?.dispute_status === "tds_deducted"
                          ? "TDS Deducted (Sec 194C/J)"
                          : data.invoice?.dispute_status ?? "None"}
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              {/* STATION 02: Payment Diagnosis & Razorpay Taxonomy */}
              <article className={styles.evidenceNode}>
                <div className={styles.nodeHead}>
                  <div className={styles.nodeIndex}>02</div>
                  <div>
                    <h3 className={styles.nodeTitle}>Payment Diagnosis & Recovery Intelligence</h3>
                    <span className={styles.nodeMeta}>
                      Official Razorpay Taxonomy v2026-09 · Deterministic Match
                    </span>
                  </div>
                  <span className={styles.nodeTag}>CLASSIFY</span>
                </div>

                <div className={styles.nodeBody}>
                  <div className={styles.diagSubNav}>
                    <button
                      className={`${styles.diagTabBtn} ${diagTab === "official" ? styles.diagTabBtnActive : ""}`}
                      onClick={() => setDiagTab("official")}
                    >
                      Official Gateway Specification
                    </button>
                    <button
                      className={`${styles.diagTabBtn} ${diagTab === "policy" ? styles.diagTabBtnActive : ""}`}
                      onClick={() => setDiagTab("policy")}
                    >
                      Vaada Recovery Policy
                    </button>
                    <button
                      className={`${styles.diagTabBtn} ${diagTab === "raw" ? styles.diagTabBtnActive : ""}`}
                      onClick={() => setDiagTab("raw")}
                    >
                      Raw Diagnostic Payload
                    </button>
                  </div>

                  {diagTab === "official" && (
                    <div className={styles.diagContent}>
                      <div className={styles.specGrid}>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Error Code</span>
                          <span className={styles.specVal} style={{ color: "var(--accent)" }}>
                            {data.payment_diagnosis?.code ?? data.root_cause ?? "BAD_REQUEST_ERROR"}
                          </span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Failure Reason</span>
                          <span className={styles.specVal}>
                            {data.payment_diagnosis?.reason ?? data.root_cause ?? "insufficient_funds"}
                          </span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Rail / Method</span>
                          <span className={styles.specVal}>
                            {data.payment_diagnosis?.payment_method ?? "UPI / Mandate"}
                          </span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Failure Source / Step</span>
                          <span className={styles.specVal}>
                            {data.payment_diagnosis?.source ?? "customer"} /{" "}
                            {data.payment_diagnosis?.step ?? "payment_authorization"}
                          </span>
                        </div>
                      </div>

                      <div className={styles.calloutCard}>
                        <div className={styles.calloutTitle}>Official Gateway Description</div>
                        <p className={styles.calloutText}>
                          {data.payment_diagnosis?.description ??
                            "The transaction failed due to insufficient funds in the debtor account or customer bank decline."}
                        </p>
                      </div>

                      <div className={styles.calloutCard}>
                        <div className={styles.calloutTitle}>Official Recommended Next Step</div>
                        <p className={styles.calloutText}>
                          {data.payment_diagnosis?.official_next_step ??
                            "Prompt customer to replenish account funds or provide alternate corporate payment method (UPI / Corporate Netbanking)."}
                        </p>
                      </div>
                    </div>
                  )}

                  {diagTab === "policy" && (
                    <div className={styles.diagContent}>
                      <div className={styles.specGrid}>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Recoverability</span>
                          <span className={styles.specVal} style={{ color: "var(--color-recovered)" }}>
                            {data.recovery_interpretation?.recoverability?.toUpperCase() ?? "RECOVERABLE"}
                          </span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Instant Retryable</span>
                          <span className={styles.specVal}>
                            {data.recovery_interpretation?.retryable ? "YES" : "NO (Switch Payment Rail)"}
                          </span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Recovery Urgency</span>
                          <span className={styles.specVal} style={{ color: "var(--accent)" }}>
                            {data.recovery_interpretation?.urgency?.toUpperCase() ?? "URGENT"}
                          </span>
                        </div>
                        <div className={styles.specItem}>
                          <span className={styles.specKey}>Human Review Required</span>
                          <span className={styles.specVal}>
                            {data.recovery_interpretation?.requires_human_review ? "YES" : "NO (Automated)"}
                          </span>
                        </div>
                      </div>

                      <div className={styles.calloutCard}>
                        <div className={styles.calloutTitle}>Recommended Merchant Action</div>
                        <p className={styles.calloutText}>
                          {data.recovery_interpretation?.merchant_action ??
                            "Dispatch automated WhatsApp promise-to-pay intent link with dynamic UPI QR code."}
                        </p>
                      </div>
                    </div>
                  )}

                  {diagTab === "raw" && (
                    <pre className={styles.rawJsonBlock}>
                      {JSON.stringify(
                        data.payment_diagnosis?.raw_payload ?? {
                          error_code: data.payment_diagnosis?.code ?? data.root_cause,
                          reason: data.payment_diagnosis?.reason ?? data.root_cause,
                          method: data.payment_diagnosis?.payment_method ?? "upi",
                          provider: "razorpay",
                        },
                        null,
                        2
                      )}
                    </pre>
                  )}
                </div>
              </article>

              {/* STATION 03 & 04: Scoring & FSM Trajectory */}
              <article className={styles.evidenceNode}>
                <div className={styles.nodeHead}>
                  <div className={styles.nodeIndex}>03/04</div>
                  <div>
                    <h3 className={styles.nodeTitle}>Scoring & Finite State Machine Trajectory</h3>
                    <span className={styles.nodeMeta}>
                      Calibrated Tabular GBDT · Optimistic Concurrency v{data.version}
                    </span>
                  </div>
                  <span className={styles.nodeTag}>ORCHESTRATE</span>
                </div>

                <div className={styles.nodeBody}>
                  <div className={styles.dagRail}>
                    {data.decision_trace.map((tr, idx) => (
                      <div key={idx} className={styles.dagNode}>
                        <div className={styles.dagStateRow}>
                          <span className={styles.dagDot} />
                          <span className={styles.dagStateName}>
                            {tr.to_state.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </div>
                        <div className={styles.dagDetails}>
                          <span className={styles.dagActor}>{tr.actor_type}</span>
                          <span className={styles.dagReason}>{tr.reason}</span>
                          <span className={styles.dagTime}>{fmtDateTime(tr.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              {/* STATION 05: Hinglish Linguistic Workspace */}
              <article className={styles.evidenceNode}>
                <div className={styles.nodeHead}>
                  <div className={styles.nodeIndex}>05</div>
                  <div>
                    <h3 className={styles.nodeTitle}>Structured Linguistic & Financial Extraction</h3>
                    <span className={styles.nodeMeta}>
                      L3Cube-HingCorpus Linguistic Pipeline · Code-Mixed NLP
                    </span>
                  </div>
                  <span className={styles.nodeTag}>EXTRACT</span>
                </div>

                <div className={styles.nodeBody}>
                  {latestPromise || lang ? (
                    <div className={styles.linguisticGrid}>
                      <div className={styles.transcriptBox}>
                        <div className={styles.boxHeader}>
                          <span>Raw Debtor Communication</span>
                          <span className={styles.subTag}>Code-Switching Detected</span>
                        </div>
                        <blockquote className={styles.quoteMsg}>
                          “{lang?.raw_text ?? latestPromise?.raw_text ?? "No communication logged."}”
                        </blockquote>
                        {lang && (
                          <div className={styles.langStats}>
                            <div className={styles.langStatItem}>
                              <span>Hindi Ratio:</span>
                              <strong>{Math.round(lang.hindi_ratio * 100)}%</strong>
                            </div>
                            <div className={styles.langStatItem}>
                              <span>English Ratio:</span>
                              <strong>{Math.round(lang.english_ratio * 100)}%</strong>
                            </div>
                            <div className={styles.langStatItem}>
                              <span>Intent:</span>
                              <strong>{lang.intent}</strong>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className={styles.promiseBox}>
                        <div className={styles.boxHeader}>
                          <span>Structured Promise-to-Pay</span>
                          <span className={styles.subTag} style={{ color: "var(--color-recovered)" }}>
                            Extracted
                          </span>
                        </div>

                        <div className={styles.promiseMetrics}>
                          <div className={styles.specItem}>
                            <span className={styles.specKey}>Promised Amount</span>
                            <span className={styles.specVal} style={{ color: "var(--accent)" }}>
                              {latestPromise
                                ? formatCurrency(latestPromise.amount_minor)
                                : "—"}
                            </span>
                          </div>
                          <div className={styles.specItem}>
                            <span className={styles.specKey}>Promise Due Date</span>
                            <span className={styles.specVal}>
                              {latestPromise ? fmtDate(latestPromise.promised_date) : "—"}
                            </span>
                          </div>
                          <div className={styles.specItem}>
                            <span className={styles.specKey}>Confidence</span>
                            <span className={styles.specVal}>
                              {latestPromise ? `${Math.round(latestPromise.confidence * 100)}%` : "—"}
                            </span>
                          </div>
                          <div className={styles.specItem}>
                            <span className={styles.specKey}>Adherence Status</span>
                            <span className={styles.specVal}>
                              {latestPromise?.is_broken ? (
                                <strong style={{ color: "var(--color-disallowed)" }}>BROKEN</strong>
                              ) : (
                                <strong style={{ color: "var(--color-recovered)" }}>ACTIVE / HONORED</strong>
                              )}
                            </span>
                          </div>
                        </div>

                        <div style={{ marginTop: 16 }}>
                          <button
                            onClick={checkPromiseAdherence}
                            disabled={busy === "check_adherence"}
                            className={styles.secondaryActionBtn}
                          >
                            {busy === "check_adherence"
                              ? "Evaluating Adherence..."
                              : "Check Promise Adherence"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.emptyStateBox}>
                      <span>No inbound debtor communications logged for this dossier yet.</span>
                    </div>
                  )}
                </div>
              </article>

              {/* Dynamic NPCI UPI & WhatsApp Preview */}
              {data.whatsapp_payload?.preview_data && (
                <article className={styles.evidenceNode}>
                  <div className={styles.nodeHead}>
                    <div className={styles.nodeIndex}>07</div>
                    <div>
                      <h3 className={styles.nodeTitle}>Outbound Channel Artifacts (WhatsApp & NPCI UPI)</h3>
                      <span className={styles.nodeMeta}>
                        Deterministic HSM Template · Corporate Virtual Account (VAN)
                      </span>
                    </div>
                    <span className={styles.nodeTag}>CHANNELS</span>
                  </div>

                  <div className={styles.nodeBody}>
                    <div className={styles.channelGrid}>
                      <div className={styles.whatsappCard}>
                        <div className={styles.boxHeader}>
                          <span>WHATSAPP OUTBOUND TEMPLATE</span>
                          <span className={styles.subTag}>HSM APPROVED</span>
                        </div>
                        <div className={styles.waContent}>
                          <p><strong>{data.whatsapp_payload.preview_data.header}</strong></p>
                          <p>{data.whatsapp_payload.preview_data.body}</p>
                        </div>
                      </div>

                      {data.upi_payload && (
                        <div className={styles.upiCard}>
                          <div className={styles.boxHeader}>
                            <span>NPCI DYNAMIC UPI INTENT</span>
                            <span className={styles.subTag}>REAL-TIME RAILS</span>
                          </div>
                          <div className={styles.specGrid}>
                            <div className={styles.specItem}>
                              <span className={styles.specKey}>Payee VPA</span>
                              <span className={styles.specVal}>{data.upi_payload.vpa}</span>
                            </div>
                            <div className={styles.specItem}>
                              <span className={styles.specKey}>Corporate VAN</span>
                              <span className={styles.specVal}>{data.upi_payload.van}</span>
                            </div>
                            <div className={styles.specItem}>
                              <span className={styles.specKey}>Bank & IFSC</span>
                              <span className={styles.specVal}>
                                {data.upi_payload.bank_name} ({data.upi_payload.ifsc})
                              </span>
                            </div>
                            <div className={styles.specItem}>
                              <span className={styles.specKey}>Payable Amount</span>
                              <span className={styles.specVal} style={{ color: "var(--accent)" }}>
                                ₹{data.upi_payload.amount_inr.toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                          <div className={styles.upiUriRow}>
                            <code>{data.upi_payload.upi_intent_uri}</code>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(data.upi_payload?.upi_intent_uri ?? "");
                                setCopiedUpi(true);
                                setTimeout(() => setCopiedUpi(false), 2000);
                              }}
                              className={styles.copyBtn}
                            >
                              {copiedUpi ? "COPIED" : "COPY URI"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )}
            </div>
          )}

          {/* TAB: Statutory Notices */}
          {activeTab === "notices" && (
            <div className={styles.tabPanel}>
              <div className={styles.tabPanelHeader}>
                <h3 className={styles.tabPanelTitle}>Statutory Legal Notices Generated</h3>
                <button
                  onClick={() => setShowNoticeGen(true)}
                  className={styles.primaryActionBtn}
                >
                  + Generate Formal Notice
                </button>
              </div>

              {data.notices.length === 0 ? (
                <div className={styles.emptyStateBox}>
                  <span>No statutory legal notices generated for this dossier yet.</span>
                </div>
              ) : (
                <div className={styles.noticesList}>
                  {data.notices.map((notice) => (
                    <div key={notice.id} className={styles.noticeCard}>
                      <div className={styles.noticeHead}>
                        <div>
                          <h4 className={styles.noticeTitle}>{notice.title}</h4>
                          <span className={styles.noticeMeta}>
                            Ref: {notice.statutory_reference} · Cure Period: {notice.cure_period_days} Days ·{" "}
                            {fmtDateTime(notice.created_at)}
                          </span>
                        </div>
                        <span className={styles.noticeStatusTag}>{notice.status.toUpperCase()}</span>
                      </div>
                      <pre className={styles.noticeContent}>{notice.content_markdown}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: Payment Reconciliations */}
          {activeTab === "reconcile" && (
            <div className={styles.tabPanel}>
              <div className={styles.tabPanelHeader}>
                <h3 className={styles.tabPanelTitle}>Settlement & Reconciliations</h3>
                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={() => setShowTDSModal(true)}
                    className={styles.secondaryActionBtn}
                  >
                    Reconcile TDS (Form 16A)
                  </button>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className={styles.primaryActionBtn}
                  >
                    Record Bank Remittance
                  </button>
                </div>
              </div>

              {data.reconciliations.length === 0 ? (
                <div className={styles.emptyStateBox}>
                  <span>No settlement or TDS reconciliations recorded yet.</span>
                </div>
              ) : (
                <div className={styles.reconcileTableWrap}>
                  <table className={styles.reconcileTable}>
                    <thead>
                      <tr>
                        <th>RECONCILIATION TYPE</th>
                        <th>AMOUNT</th>
                        <th>REFERENCE / CERTIFICATE #</th>
                        <th>RECONCILED BY</th>
                        <th>TIMESTAMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reconciliations.map((rec) => (
                        <tr key={rec.id}>
                          <td>
                            <strong>{rec.reconciliation_type.toUpperCase()}</strong>
                          </td>
                          <td style={{ color: "var(--color-recovered)", fontWeight: 600 }}>
                            {formatCurrency(rec.amount_minor)}
                          </td>
                          <td>
                            <code>{rec.reference_number}</code>
                          </td>
                          <td>{rec.reconciled_by}</td>
                          <td>{fmtDateTime(rec.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: Audit Trail */}
          {activeTab === "audit" && (
            <div className={styles.tabPanel}>
              <div className={styles.tabPanelHeader}>
                <h3 className={styles.tabPanelTitle}>Tamper-Evident Dossier Audit Trail</h3>
                <span className={styles.noticeMeta}>Immutable append-only ledger</span>
              </div>

              <div className={styles.auditList}>
                {data.audit.map((item, idx) => (
                  <div key={idx} className={styles.auditItem}>
                    <div className={styles.auditHead}>
                      <span className={styles.auditAction}>{item.action}</span>
                      <span className={styles.auditActor}>{item.actor_type}</span>
                      <span className={styles.auditTime}>{fmtDateTime(item.created_at)}</span>
                    </div>
                    <pre className={styles.auditPayload}>
                      {JSON.stringify(JSON.parse(item.payload_json || "{}"), null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right: Operator Action Deck */}
        <aside className={styles.actionDeck}>
          <div className={styles.deckCard}>
            <div className={styles.deckHeader}>
              <span className={styles.deckTitle}>OPERATOR ACTION DECK</span>
              <span className={styles.deckState}>{data.state.toUpperCase()}</span>
            </div>

            <div className={styles.deckBody}>
              <div className={styles.reasonField}>
                <label className={styles.fieldLabel}>Intervention Justification:</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={styles.reasonInput}
                />
              </div>

              <div className={styles.btnGrid}>
                {canRemind && (
                  <button
                    onClick={() => act("send_reminder")}
                    disabled={!!busy}
                    className={styles.deckPrimaryBtn}
                  >
                    {busy === "send_reminder" ? "Dispatching..." : "Send Reminder (T-1 Notice)"}
                  </button>
                )}

                {canRemind && (
                  <button
                    onClick={() => act("request_promise")}
                    disabled={!!busy}
                    className={styles.deckSecondaryBtn}
                  >
                    {busy === "request_promise" ? "Queuing..." : "Request Binding Promise"}
                  </button>
                )}

                <button
                  onClick={() => setShowNoticeGen(true)}
                  disabled={!!busy}
                  className={styles.deckSecondaryBtn}
                >
                  Generate Statutory Notice
                </button>

                <button
                  onClick={() => setShowTDSModal(true)}
                  disabled={!!busy}
                  className={styles.deckSecondaryBtn}
                >
                  Reconcile Section 194C/J TDS
                </button>

                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={!!busy}
                  className={styles.deckSecondaryBtn}
                >
                  Record Bank Remittance
                </button>

                <button
                  onClick={() => act("escalate")}
                  disabled={!!busy || isTerminal || data.state === "human_review"}
                  className={styles.deckWarningBtn}
                >
                  Escalate to Human Review
                </button>

                {!isTerminal && (
                  <button
                    onClick={() => act("mark_recovered")}
                    disabled={!!busy}
                    className={styles.deckSuccessBtn}
                  >
                    Mark As Recovered
                  </button>
                )}

                {!isTerminal && (
                  <button
                    onClick={() => act("mark_unrecoverable")}
                    disabled={!!busy}
                    className={styles.deckDangerBtn}
                  >
                    Mark Unrecoverable
                  </button>
                )}
              </div>
            </div>

            <div className={styles.deckSummary}>
              <div className={styles.deckSumItem}>
                <span>Customer Channel</span>
                <strong>{data.customer?.contact_channel ?? "whatsapp"}</strong>
              </div>
              <div className={styles.deckSumItem}>
                <span>Contact Phone</span>
                <strong>{data.customer?.contact_value ?? "—"}</strong>
              </div>
              <div className={styles.deckSumItem}>
                <span>Contact Attempts</span>
                <strong>{data.contact_attempt_count} of 3 (Rolling 7d)</strong>
              </div>
              <div className={styles.deckSumItem}>
                <span>Dossier Concurrency</span>
                <strong>Version {data.version}</strong>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── MODALS ── */}

      {/* Notice Generation Modal */}
      {showNoticeGen && (
        <div className={styles.modalOverlay} onClick={() => setShowNoticeGen(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>Generate Formal Statutory Legal Notice</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowNoticeGen(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                Select the formal statutory legal notice format according to Indian commercial code:
              </p>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Notice Format:</label>
                <select
                  value={noticeType}
                  onChange={(e) => setNoticeType(e.target.value)}
                  className={styles.modalSelect}
                >
                  <option value="msme_43b_h">MSME Section 43B(h) Tax Disallowance Notice (7-Day Cure)</option>
                  <option value="section_138_ni">Section 138 NI Act / Sec 25 PSSA Legal Demand Notice</option>
                  <option value="msefc_samadhaan">MSEFC Samadhaan Form 1 Pre-Filing Dispute Notice</option>
                  <option value="statement_of_account">Formal Statement of Account & Balance Confirmation</option>
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={generateStatutoryNotice}
                disabled={busy === "generate_notice"}
                className={styles.primaryActionBtn}
              >
                {busy === "generate_notice" ? "Generating Notice..." : "Generate Formal Notice"}
              </button>
              <button onClick={() => setShowNoticeGen(false)} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TDS Reconciliation Modal */}
      {showTDSModal && (
        <div className={styles.modalOverlay} onClick={() => setShowTDSModal(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>Reconcile Section 194C/J TDS Deduction</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowTDSModal(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                Indian corporate buyers routinely withhold 1% (194C individual), 2% (194C corporate), or 10% (194J professional). Record Form 16A acknowledgement to update the net recoverable balance without default classification.
              </p>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>TDS Rate (%):</label>
                <input
                  type="text"
                  value={tdsRate}
                  onChange={(e) => setTdsRate(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Form 16A Certificate / Ack #:</label>
                <input
                  type="text"
                  value={form16aAck}
                  onChange={(e) => setForm16aAck(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={submitTDSReconcile}
                disabled={busy === "reconcile_tds"}
                className={styles.primaryActionBtn}
              >
                {busy === "reconcile_tds" ? "Reconciling TDS..." : "Confirm TDS Reconciliation"}
              </button>
              <button onClick={() => setShowTDSModal(false)} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Remittance Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay} onClick={() => setShowPaymentModal(false)}>
          <div className={styles.modalDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h3 className={styles.modalTitle}>Record Inward Bank Remittance</h3>
              <button className={styles.modalCloseBtn} onClick={() => setShowPaymentModal(false)}>
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalDesc}>
                Record verified RTGS/NEFT/UPI inward funds received in the merchant bank account:
              </p>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Remitted Amount (₹ INR):</label>
                <input
                  type="text"
                  placeholder="180000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Bank UTR / Transaction Reference:</label>
                <input
                  type="text"
                  value={payUtr}
                  onChange={(e) => setPayUtr(e.target.value)}
                  className={styles.modalInput}
                />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                onClick={submitPaymentReconcile}
                disabled={busy === "reconcile_payment"}
                className={styles.primaryActionBtn}
              >
                {busy === "reconcile_payment" ? "Matching Remittance..." : "Confirm Remittance"}
              </button>
              <button onClick={() => setShowPaymentModal(false)} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
