"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { soundbox } from "@/lib/soundbox";
import { parseHinglishCommitment, HINGLISH_SANDBOX_PRESETS } from "@/lib/hinglishParser";
import DashboardNav from "@/components/DashboardNav";
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

const HUMAN_STATE_DESCRIPTIONS: Record<string, { label: string; actionHint: string; color: string; bg: string; border: string }> = {
  open: { label: "Ingested", actionHint: "Classifying gateway error", color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  classified: { label: "Diagnosed", actionHint: "Evaluating recovery policy", color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  awaiting_action: { label: "Action Pending", actionHint: "Ready for payment reminder", color: "var(--status-pending)", bg: "rgba(196, 148, 58, 0.12)", border: "rgba(196, 148, 58, 0.3)" },
  contacted: { label: "Debtor Contacted", actionHint: "WhatsApp delivery sent", color: "var(--status-pending)", bg: "rgba(196, 148, 58, 0.12)", border: "rgba(196, 148, 58, 0.3)" },
  awaiting_response: { label: "Awaiting Reply", actionHint: "Waiting on customer commitment", color: "var(--status-pending)", bg: "rgba(196, 148, 58, 0.12)", border: "rgba(196, 148, 58, 0.3)" },
  promise_recorded: { label: "Promise Committed", actionHint: "Debtor scheduled payment", color: "var(--status-recovered)", bg: "rgba(34, 201, 151, 0.12)", border: "rgba(34, 201, 151, 0.3)" },
  human_review: { label: "Needs Operator Review", actionHint: "Dispute or manual escalation", color: "var(--status-warning)", bg: "rgba(138, 108, 196, 0.12)", border: "rgba(138, 108, 196, 0.3)" },
  paused: { label: "Temporarily Paused", actionHint: "Debtor requested grace period", color: "var(--text-muted)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  blocked: { label: "Compliance Blocked", actionHint: "Exceeded 3 contacts / 7d cap", color: "var(--status-disallowed)", bg: "rgba(232, 80, 80, 0.12)", border: "rgba(232, 80, 80, 0.3)" },
  recovered: { label: "Settled & Verified", actionHint: "Bank remittance matched", color: "var(--status-recovered)", bg: "rgba(34, 201, 151, 0.12)", border: "rgba(34, 201, 151, 0.3)" },
  unrecoverable: { label: "Marked Bad Debt", actionHint: "Exhausted statutory rails", color: "var(--status-disallowed)", bg: "rgba(232, 80, 80, 0.12)", border: "rgba(232, 80, 80, 0.3)" },
};

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

  // Debtor Hinglish Intake Simulator Bench
  const [operatorHinglishInput, setOperatorHinglishInput] = useState(
    HINGLISH_SANDBOX_PRESETS[0].text
  );
  const parsedOperatorHinglish = parseHinglishCommitment(operatorHinglishInput);

  // Progressive Disclosure Trays
  const [showRawPayload, setShowRawPayload] = useState(false);
  const [showDecisionDag, setShowDecisionDag] = useState(false);

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
      setActionSuccess(`Action successfully applied: ${action.replace("_", " ")}`);
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
      soundbox.triggerSettlementCelebration(amountPaise, "Bank UTR Remittance");
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
      <div className={styles.caseShell}>
        <div className={styles.unauthorizedBox}>
          <span className={styles.unauthTag}>OPERATOR SESSION REQUIRED</span>
          <h2 className={styles.unauthTitle}>Authentication Needed</h2>
          <p className={styles.unauthBody}>
            You must be signed in with an active operator account to inspect confidential debtor records.
          </p>
          <Link href="/login" className={styles.unauthBtn}>Sign In With Demo Account →</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.caseShell}>
        <div className={styles.errorBox}>
          <span>Error loading case dossier: {error}</span>
          <Link href="/queue" className={styles.backBtn}>← Return to Portfolio Queue</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.caseShell}>
        <div className={styles.loadingBox}>Loading recovery dossier...</div>
      </div>
    );
  }

  const stat = data.statutory_status;
  const isTerminal = TERMINAL_STATES.has(data.state);
  const probPct = data.recovery_probability != null ? Math.round(data.recovery_probability * 100) : null;
  const stateMeta = HUMAN_STATE_DESCRIPTIONS[data.state] || {
    label: data.state,
    actionHint: "In progress",
    color: "var(--text-secondary)",
    bg: "var(--bg-elevated)",
  };

  return (
    <div className={styles.caseShell}>
      <DashboardNav title="Case Dossier" />
      {/* ── Fixed Chapter Header Bar ── */}
      <nav className={styles.caseNav}>
        <div className={styles.navLeft}>
          <Link href="/queue" className={styles.backLink}>← Commercial Receivables</Link>
          <span className={styles.navDivider}>/</span>
          <span className={styles.caseInvoiceId}>{data.invoice_number ?? data.id.slice(0, 8)}</span>
          <span className={styles.customerHeaderName}>{data.customer?.display_name ?? "—"}</span>
          <span className={styles.casePrincipalHeader}>{formatCurrency(data.amount_minor)}</span>
          <span
            className={styles.statusPill}
            style={{
              color: stateMeta.color,
              backgroundColor: stateMeta.bg,
              border: `1px solid ${stateMeta.border || "transparent"}`,
            }}
          >
            {stateMeta.label}
          </span>
          {data.credit_risk_tier && (
            <span className={styles.riskTierHeaderBadge}>
              {data.credit_risk_tier.toUpperCase()} RISK
            </span>
          )}
        </div>

        <div className={styles.navRight}>
          <span className={styles.contactsRemaining}>
            {data.contact_attempt_count} / 3 Contacts (09:00–20:00 Window)
          </span>
        </div>
      </nav>

      {/* ── Permanent Financial Telemetry Strip ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className={styles.financialStrip}
      >
        <div className={styles.stripItem}>
          <span className={styles.stripLabel}>PRINCIPAL RECEIVABLE</span>
          <span className={styles.stripValue}>{formatCurrency(data.amount_minor)}</span>
          <span className={styles.stripMeta}>Issued: {fmtDate(data.invoice?.issued_at)}</span>
        </div>

        <div className={styles.stripItem}>
          <span className={styles.stripLabel}>NET PAYABLE (POST-TDS)</span>
          <span className={styles.stripValue} style={{ color: "var(--text-primary)" }}>
            {formatCurrency(data.net_payable_minor ?? data.amount_minor)}
          </span>
          <span className={styles.stripMeta}>
            {data.invoice?.tds_minor ? `Less ${data.invoice.tds_rate_percent}% Form 16A TDS` : "Zero TDS Deducted"}
          </span>
        </div>

        <div className={styles.stripItem}>
          <span className={styles.stripLabel}>SECTION 43B(H) STATUTORY CLOCK</span>
          <span
            className={styles.stripValue}
            style={{
              color: stat?.is_disallowed
                ? "var(--color-disallowed)"
                : stat?.days_remaining != null && stat.days_remaining <= 5
                ? "var(--color-warning)"
                : "var(--accent)",
            }}
          >
            {stat?.is_disallowed
              ? "Disallowed (Tax Penalty)"
              : stat?.days_remaining != null
              ? `${stat.days_remaining} Days Remaining`
              : "Non-MSME Buyer"}
          </span>
          <span className={styles.stripMeta}>
            {stat?.is_disallowed
              ? "31.2% Corporate Tax Penalty Triggered"
              : `Statutory Cure Cutoff: ${fmtDate(stat?.statutory_due_date)}`}
          </span>
        </div>

        <div className={styles.stripItem}>
          <span className={styles.stripLabel}>3× PENAL INTEREST (SEC 16)</span>
          <span className={styles.stripValue} style={{ color: "var(--color-recovered)" }}>
            {formatCurrency(stat?.statutory_interest_minor ?? data.statutory_interest_minor ?? 0)}
          </span>
          <span className={styles.stripMeta}>
            {stat?.interest_rate_percent ? `${stat.interest_rate_percent}% p.a. Compounded Monthly` : "Statutory Accrual"}
          </span>
        </div>

        <div className={styles.stripItem}>
          <span className={styles.stripLabel}>ESTIMATED RECOVERY</span>
          <span className={styles.stripValue} style={{ color: "var(--color-recovered)" }}>
            {probPct != null ? `${probPct}%` : "—"}
          </span>
          <span className={styles.stripMeta}>
            {probPct != null && probPct >= 65 ? "High Confidence" : "Moderate Risk"}
          </span>
        </div>
      </motion.section>

      {/* Notifications */}
      {actionSuccess && (
        <div className={styles.successBanner}>
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess("")} className={styles.closeBannerBtn}>×</button>
        </div>
      )}
      {actionError && (
        <div className={styles.errorBanner}>
          <span>✕ {actionError}</span>
          <button onClick={() => setActionError("")} className={styles.closeBannerBtn}>×</button>
        </div>
      )}

      {/* ── Main Investigation Suite ── */}
      <div className={styles.suiteLayout}>
        <div className={styles.suiteMain}>
          {/* Investigation Tabs */}
          <div className={styles.tabBar}>
            <button
              className={`${styles.tabBtn} ${activeTab === "dossier" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("dossier")}
            >
              Receivable Lifecycle & Narrative
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "notices" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("notices")}
            >
              Statutory Notices ({data.notices?.length || 0})
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "reconcile" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("reconcile")}
            >
              Tax & Remittance Ledger ({data.reconciliations?.length || 0})
            </button>
            <button
              className={`${styles.tabBtn} ${activeTab === "audit" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("audit")}
            >
              Audit Trail ({data.audit?.length || 0})
            </button>
          </div>

          {/* Tab 1: Receivable Narrative Journey */}
          {activeTab === "dossier" && (
            <div className={styles.narrativeJourney}>
              {/* Chapter 1: The Commercial Receivable & Debtor */}
              <motion.div
                className={styles.narrativeCard}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35 }}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.chapterNum}>CHAPTER 1 · THE COMMERCIAL RECEIVABLE</span>
                    <h3 className={styles.cardTitle}>Enterprise Buyer & Contractual Invoice</h3>
                  </div>
                  {data.customer?.is_msme && (
                    <span className={styles.msmeBadge}>
                      MSME Registered · {data.customer.msme_category ?? "Small"} Enterprise
                    </span>
                  )}
                </div>

                <div className={styles.cardGrid}>
                  <div className={styles.gridItem}>
                    <span className={styles.itemLabel}>ENTERPRISE BUYER</span>
                    <span className={styles.itemValue}>{data.customer?.display_name ?? "—"}</span>
                    <span className={styles.itemSub}>{data.customer?.contact_value}</span>
                  </div>
                  <div className={styles.gridItem}>
                    <span className={styles.itemLabel}>GSTIN IDENTITY</span>
                    <span className={styles.itemValue}>{data.customer?.gstin ?? "Unregistered"}</span>
                    <span className={styles.itemSub}>PAN: {data.customer?.pan ?? "—"}</span>
                  </div>
                  <div className={styles.gridItem}>
                    <span className={styles.itemLabel}>INVOICE & E-INVOICE IRN</span>
                    <span className={styles.itemValue}>{data.invoice?.invoice_number ?? "—"}</span>
                    <span className={styles.itemSub}>{data.invoice?.e_invoice_irn ? "Government IRN Verified" : "Standard Tax Invoice"}</span>
                  </div>
                  <div className={styles.gridItem}>
                    <span className={styles.itemLabel}>DISPUTE STATUS</span>
                    <span className={styles.itemValue} style={{ color: "var(--color-recovered)" }}>
                      {data.invoice?.dispute_status === "clean" ? "Clean — Zero Commercial Dispute" : data.invoice?.dispute_status}
                    </span>
                    <span className={styles.itemSub}>Due Date: {fmtDate(data.invoice?.due_at)}</span>
                  </div>
                </div>
              </motion.div>

              {/* Chapter 2: The Gateway Payment Event */}
              <motion.div
                className={styles.narrativeCard}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.05 }}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.chapterNum}>CHAPTER 2 · PAYMENT GATEWAY DIAGNOSIS</span>
                    <h3 className={styles.cardTitle}>Why The Payment Failed on Razorpay</h3>
                  </div>
                  <span className={styles.officialPill}>Official Gateway Specification</span>
                </div>

                {data.payment_diagnosis ? (
                  <div className={styles.diagnosisBody}>
                    <div className={styles.diagSummaryRow}>
                      <div className={styles.diagCodeCol}>
                        <span className={styles.itemLabel}>RAZORPAY ERROR CODE & ROOT CAUSE</span>
                        <span className={styles.diagCodeText}>
                          {data.payment_diagnosis.code} : {data.payment_diagnosis.reason}
                        </span>
                        <p className={styles.diagDescText}>{data.payment_diagnosis.description}</p>
                      </div>

                      <div className={styles.diagPolicyCol}>
                        <span className={styles.itemLabel}>VAADA DERIVED RECOVERY ACTION</span>
                        <span className={styles.policyText}>
                          {data.recovery_interpretation?.policy_decision ?? "Autonomous Reminder Dispatch"}
                        </span>
                        <p className={styles.policyDescText}>
                          {data.recovery_interpretation?.merchant_action ?? "Contact customer during 08:00–19:00 IST window via WhatsApp HSM."}
                        </p>
                      </div>
                    </div>

                    {/* Level 5 Progressive Disclosure Trigger */}
                    <div className={styles.progressiveTriggerRow}>
                      <button
                        onClick={() => setShowRawPayload(!showRawPayload)}
                        className={styles.progressiveBtn}
                      >
                        {showRawPayload ? "Hide Raw Gateway Payload ↑" : "Inspect Raw Gateway Diagnostic JSON (Level 5) ↓"}
                      </button>
                    </div>

                    {showRawPayload && (
                      <pre className={styles.rawJsonPre}>
                        {JSON.stringify(data.payment_diagnosis.raw_payload || data.payment_diagnosis, null, 2)}
                      </pre>
                    )}
                  </div>
                ) : (
                  <div className={styles.emptyNote}>Zero payment failures logged for this invoice.</div>
                )}
              </motion.div>

              {/* Chapter 3: The Debtor's Commitment (Hinglish Intelligence) */}
              <motion.div
                className={styles.narrativeCard}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.1 }}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.chapterNum}>CHAPTER 3 · DEBTOR CONVERSATION & COMMITMENT</span>
                    <h3 className={styles.cardTitle}>What The Customer Stated (Hinglish NLP)</h3>
                  </div>
                  {data.promises?.length > 0 && (
                    <button
                      onClick={checkPromiseAdherence}
                      disabled={busy === "check_adherence"}
                      className={styles.checkPromiseBtn}
                    >
                      {busy === "check_adherence" ? "Verifying..." : "Verify Adherence Against Bank Records"}
                    </button>
                  )}
                </div>

                {data.promises?.length > 0 ? (
                  <div className={styles.promisesList}>
                    {data.promises.map((p, idx) => (
                      <div key={idx} className={styles.promiseBox}>
                        <div className={styles.rawMessageQuote}>
                          &ldquo;{p.raw_text}&rdquo;
                        </div>

                        <div className={styles.promiseDetailsGrid}>
                          <div>
                            <span className={styles.itemLabel}>PROMISED SETTLEMENT DATE</span>
                            <span className={styles.itemValue}>{fmtDate(p.promised_date)}</span>
                          </div>
                          <div>
                            <span className={styles.itemLabel}>BINDING PROMISED AMOUNT</span>
                            <span className={styles.itemValue} style={{ color: "var(--accent)" }}>
                              {formatCurrency(p.amount_minor)}
                            </span>
                          </div>
                          <div>
                            <span className={styles.itemLabel}>COMMITMENT CONFIDENCE</span>
                            <span className={styles.itemValue} style={{ color: "var(--status-recovered)" }}>
                              {Math.round(p.confidence * 100)}% Intent Strength
                            </span>
                          </div>
                          <div>
                            <span className={styles.itemLabel}>ADHERENCE STATUS</span>
                            <span className={styles.itemValue}>
                              {p.is_broken ? (
                                <span style={{ color: "var(--status-disallowed)" }}>Broken Commitment</span>
                              ) : (
                                <span style={{ color: "var(--status-recovered)" }}>Active Scheduled Promise</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyNote}>
                    No WhatsApp promise recorded yet. Dispatch a payment reminder from the action deck.
                  </div>
                )}

                {/* Interactive Debtor Hinglish Commitment Simulator */}
                <div className={styles.hinglishIntakeBench}>
                  <div className={styles.intakeHeaderRow}>
                    <span className={styles.intakeTitle}>
                      <span>🧠</span> Debtor Commitment Simulator (Hinglish Engine)
                    </span>
                    <span className={styles.intakeBadge}>Live NLP Intake</span>
                  </div>

                  <div className={styles.presetChipsRow}>
                    {HINGLISH_SANDBOX_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setOperatorHinglishInput(preset.text)}
                        className={`${styles.presetChip} ${
                          operatorHinglishInput === preset.text ? styles.presetChipActive : ""
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={2}
                    value={operatorHinglishInput}
                    onChange={(e) => setOperatorHinglishInput(e.target.value)}
                    className={styles.operatorHinglishTextarea}
                    placeholder="Type or paste debtor WhatsApp reply in Hindi / Hinglish..."
                  />

                  <div className={styles.tokenHighlightRow}>
                    {parsedOperatorHinglish.tokens.map((token, i) => (
                      <span
                        key={i}
                        className={`${styles.tokenTag} ${styles[`token_${token.type}`] || ""}`}
                      >
                        {token.text}
                      </span>
                    ))}
                  </div>

                  <div className={styles.contractPreviewBox}>
                    <div className={styles.contractPreviewLabel}>
                      SYNTHESIZED SETTLEMENT OBLIGATION
                    </div>
                    <div className={styles.contractSummaryText}>
                      Pledged remittance of <strong>{parsedOperatorHinglish.amount}</strong> via{" "}
                      <strong>{parsedOperatorHinglish.rail}</strong> scheduled for{" "}
                      <strong>{parsedOperatorHinglish.date}</strong>. Policy action:{" "}
                      <em>{parsedOperatorHinglish.action}</em>.
                    </div>
                    <div className={styles.contractConfidenceMeta}>
                      <span>Confidence: {parsedOperatorHinglish.confidenceScore.toFixed(1)}%</span>
                      <span>·</span>
                      <span>Rail: {parsedOperatorHinglish.rail}</span>
                      <span>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          const amtMinor = (parsedOperatorHinglish.amountNumeric || 0) * 100 || (data.amount_minor || 0);
                          soundbox.speakSettlementAnnouncement(
                            amtMinor,
                            parsedOperatorHinglish.rail
                          );
                        }}
                        className={styles.miniVoiceBtn}
                      >
                        🔊 Hear Gateway Voice
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Chapter 4: Outbound Channels (WhatsApp HSM & NPCI UPI Intent) */}
              <motion.div
                className={styles.narrativeCard}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: 0.15 }}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.chapterNum}>CHAPTER 4 · DISPATCHED CHANNELS</span>
                    <h3 className={styles.cardTitle}>Payment Rails & Outbound Artifacts</h3>
                  </div>
                </div>

                <div className={styles.channelsGrid}>
                  {/* WhatsApp HSM Preview */}
                  <div className={styles.whatsappCard}>
                    <span className={styles.channelLabel}>WHATSAPP BUSINESS HSM TEMPLATE</span>
                    <div className={styles.whatsappBubble}>
                      <div className={styles.waHeader}>
                        {data.whatsapp_payload?.preview_data?.header ?? "Invoice Settlement Notice"}
                      </div>
                      <p className={styles.waBody}>
                        {data.whatsapp_payload?.preview_data?.body ??
                          `Dear ${data.customer?.display_name}, your invoice ${data.invoice?.invoice_number} of ${formatCurrency(data.amount_minor)} is pending. Please click below to settle via instant UPI.`}
                      </p>
                      <div className={styles.waButton}>
                        Pay {formatCurrency(data.amount_minor)} via UPI
                      </div>
                    </div>
                  </div>

                  {/* NPCI UPI Dynamic QR & Intent */}
                  <div className={styles.upiCard}>
                    <span className={styles.channelLabel}>NPCI DYNAMIC UPI INTENT</span>
                    <div className={styles.upiDetails}>
                      <div>
                        <span className={styles.itemLabel}>VIRTUAL PAYMENT ADDRESS (VPA)</span>
                        <span className={styles.upiMonoText}>
                          {data.upi_payload?.vpa ?? "vaada.syn1001@icici"}
                        </span>
                      </div>
                      <div>
                        <span className={styles.itemLabel}>VIRTUAL ACCOUNT NUMBER (VAN)</span>
                        <span className={styles.upiMonoText}>
                          {data.upi_payload?.van ?? "VAADAYN1001"}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(data.upi_payload?.upi_intent_uri || "");
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 2000);
                        }}
                        className={styles.copyUpiBtn}
                      >
                        {copiedUpi ? "✓ Copied Intent URI" : "Copy UPI Intent Link"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Tab 2: Statutory Notices */}
          {activeTab === "notices" && (
            <div className={styles.noticesTab}>
              <div className={styles.noticesHeader}>
                <div>
                  <h3 className={styles.tabTitle}>Formal Statutory Legal Notices</h3>
                  <p className={styles.tabSubtitle}>
                    Drafted under Indian commercial statutes: MSMED Act 2006, Section 43B(h), and Negotiable Instruments Act Section 138.
                  </p>
                </div>
                <button
                  onClick={() => setShowNoticeGen(true)}
                  className={styles.generateNoticeBtn}
                >
                  + Generate Formal Notice
                </button>
              </div>

              {data.notices?.length > 0 ? (
                <div className={styles.noticesGrid}>
                  {data.notices.map((n) => (
                    <div key={n.id} className={styles.noticeCard}>
                      <div className={styles.noticeCardTop}>
                        <span className={styles.noticeTypeTag}>{n.notice_type.replace(/_/g, " ").toUpperCase()}</span>
                        <span className={styles.noticeDate}>{fmtDate(n.created_at)}</span>
                      </div>
                      <h4 className={styles.noticeTitle}>{n.title}</h4>
                      <span className={styles.noticeStatRef}>{n.statutory_reference}</span>
                      <div className={styles.noticeAmounts}>
                        <div>
                          <span className={styles.itemLabel}>CLAIM AMOUNT</span>
                          <span className={styles.itemValue}>{formatCurrency(n.claim_amount_minor)}</span>
                        </div>
                        <div>
                          <span className={styles.itemLabel}>3× PENAL INTEREST</span>
                          <span className={styles.itemValue} style={{ color: "var(--color-recovered)" }}>
                            {formatCurrency(n.statutory_interest_minor)}
                          </span>
                        </div>
                      </div>
                      <pre className={styles.noticeMarkdown}>{n.content_markdown}</pre>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyNote}>
                  Zero legal notices served. Click &quot;+ Generate Formal Notice&quot; to issue a statutory demand.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Tax & Reconciliation Ledger */}
          {activeTab === "reconcile" && (
            <div className={styles.reconcileTab}>
              <div className={styles.reconcileHeader}>
                <div>
                  <h3 className={styles.tabTitle}>Statutory Tax & Remittance Ledger</h3>
                  <p className={styles.tabSubtitle}>
                    Form 16A withholding tax (Section 194C/194J) and bank inward RTGS/NEFT settlement matching.
                  </p>
                </div>
                <div className={styles.reconcileActions}>
                  <button onClick={() => setShowTDSModal(true)} className={styles.reconcileBtn}>
                    Reconcile TDS (Form 16A)
                  </button>
                  <button onClick={() => setShowPaymentModal(true)} className={styles.settleBtn}>
                    Match Bank Remittance
                  </button>
                </div>
              </div>

              {data.reconciliations?.length > 0 ? (
                <div className={styles.reconcileList}>
                  {data.reconciliations.map((r) => (
                    <div key={r.id} className={styles.reconcileItem}>
                      <div>
                        <span className={styles.itemLabel}>RECONCILIATION TYPE</span>
                        <span className={styles.itemValue}>{r.reconciliation_type.toUpperCase()}</span>
                      </div>
                      <div>
                        <span className={styles.itemLabel}>AMOUNT SETTLED</span>
                        <span className={styles.itemValue} style={{ color: "var(--color-recovered)" }}>
                          {formatCurrency(r.amount_minor)}
                        </span>
                      </div>
                      <div>
                        <span className={styles.itemLabel}>REFERENCE / UTR</span>
                        <span className={styles.itemValue}>{r.reference_number}</span>
                      </div>
                      <div>
                        <span className={styles.itemLabel}>RECONCILED BY</span>
                        <span className={styles.itemValue}>{r.reconciled_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyNote}>
                  Zero reconciliations recorded. Reconcile TDS or match bank remittances using the controls above.
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Audit Trail */}
          {activeTab === "audit" && (
            <div className={styles.auditTab}>
              <h3 className={styles.tabTitle}>Cryptographic Immutable Audit Trail</h3>
              <p className={styles.tabSubtitle}>
                Every state transition, model inference, and operator action is cryptographically recorded.
              </p>

              <div className={styles.auditList}>
                {data.audit?.map((item, idx) => (
                  <div key={idx} className={styles.auditRow}>
                    <span className={styles.auditTime}>{fmtDateTime(item.created_at)}</span>
                    <span className={styles.auditAction}>{item.action}</span>
                    <span className={styles.auditActor}>{item.actor_type}</span>
                    <span className={styles.auditPayload}>{item.payload_json}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Operator Action Deck (Sidebar) ── */}
        <aside className={styles.actionDeck}>
          <div className={styles.deckHeader}>
            <span className={styles.deckTag}>OPERATOR CONTROLS</span>
            <h4 className={styles.deckTitle}>Recovery Actions</h4>
          </div>

          <div className={styles.reasonField}>
            <label className={styles.reasonLabel}>AUDIT JUSTIFICATION</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={styles.reasonInput}
              placeholder="State reason for operator action..."
            />
          </div>

          <div className={styles.actionButtonsList}>
            {CAN_SEND_REMINDER.has(data.state) && (
              <button
                onClick={() => act("send_reminder")}
                disabled={busy !== null}
                className={styles.primaryActionBtn}
              >
                {busy === "send_reminder" ? "Dispatching..." : "Dispatch WhatsApp Reminder"}
              </button>
            )}

            {data.state === "awaiting_action" && (
              <button
                onClick={() => act("request_promise")}
                disabled={busy !== null}
                className={styles.secondaryActionBtn}
              >
                {busy === "request_promise" ? "Sending..." : "Request Formal Commitment"}
              </button>
            )}

            {!isTerminal && (
              <button
                onClick={() => setShowNoticeGen(true)}
                className={styles.secondaryActionBtn}
              >
                Generate Legal Notice
              </button>
            )}

            {!isTerminal && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className={styles.settleActionBtn}
              >
                Match Bank Remittance (Settle)
              </button>
            )}

            {!isTerminal && data.state !== "human_review" && (
              <button
                onClick={() => act("escalate")}
                disabled={busy !== null}
                className={styles.escalateBtn}
              >
                {busy === "escalate" ? "Escalating..." : "Escalate to Human Review"}
              </button>
            )}

            {!isTerminal && (
              <button
                onClick={() => act("mark_unrecoverable")}
                disabled={busy !== null}
                className={styles.badDebtBtn}
              >
                {busy === "mark_unrecoverable" ? "Recording..." : "Mark Bad Debt"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* ── Modal: Formal Statutory Notice Generator ── */}
      {showNoticeGen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Generate Formal Statutory Notice</h3>
              <button onClick={() => setShowNoticeGen(false)} className={styles.closeModalBtn}>×</button>
            </div>
            <p className={styles.modalSub}>
              Select the governing statute to compile a legally enforceable demand letter citing Indian law.
            </p>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>STATUTORY FRAMEWORK</label>
              <select
                value={noticeType}
                onChange={(e) => setNoticeType(e.target.value)}
                className={styles.modalSelect}
              >
                <option value="msme_43b_h">Income Tax Act Section 43B(h) — 45-Day Disallowance</option>
                <option value="sec_138_ni_act">Negotiable Instruments Act Section 138 — Dishonour Demand</option>
                <option value="msme_samadhaan_form_1">MSEFC Samadhaan Form 1 — Statutory Conciliation</option>
              </select>
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => setShowNoticeGen(false)} className={styles.cancelBtn}>Cancel</button>
              <button
                onClick={generateStatutoryNotice}
                disabled={busy === "generate_notice"}
                className={styles.confirmBtn}
              >
                {busy === "generate_notice" ? "Compiling..." : "Generate Notice Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Section 194C/J TDS Reconciliation ── */}
      {showTDSModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Reconcile Section 194C/J TDS</h3>
              <button onClick={() => setShowTDSModal(false)} className={styles.closeModalBtn}>×</button>
            </div>
            <p className={styles.modalSub}>
              Enter the corporate buyer&apos;s Tax Deducted at Source (TDS) percentage and Form 16A acknowledgment.
            </p>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>TDS WITHHOLDING RATE (%)</label>
              <input
                type="number"
                step="0.1"
                value={tdsRate}
                onChange={(e) => setTdsRate(e.target.value)}
                className={styles.modalInput}
              />
            </div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>FORM 16A ACKNOWLEDGMENT NUMBER</label>
              <input
                type="text"
                value={form16aAck}
                onChange={(e) => setForm16aAck(e.target.value)}
                className={styles.modalInput}
              />
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => setShowTDSModal(false)} className={styles.cancelBtn}>Cancel</button>
              <button
                onClick={submitTDSReconcile}
                disabled={busy === "reconcile_tds"}
                className={styles.confirmBtn}
              >
                {busy === "reconcile_tds" ? "Recording..." : "Apply TDS Deduction"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Bank Remittance Match ── */}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Match Bank Inward Remittance</h3>
              <button onClick={() => setShowPaymentModal(false)} className={styles.closeModalBtn}>×</button>
            </div>
            <p className={styles.modalSub}>
              Match verified RTGS, NEFT, or IMPS funds from your bank statement against this invoice.
            </p>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>REMITTANCE AMOUNT (₹ INR)</label>
              <input
                type="number"
                placeholder={String((data.net_payable_minor ?? data.amount_minor ?? 0) / 100)}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className={styles.modalInput}
              />
            </div>

            <div className={styles.modalField}>
              <label className={styles.modalLabel}>BANK TRANSACTION UTR</label>
              <input
                type="text"
                value={payUtr}
                onChange={(e) => setPayUtr(e.target.value)}
                className={styles.modalInput}
              />
            </div>

            <div className={styles.modalFooter}>
              <button onClick={() => setShowPaymentModal(false)} className={styles.cancelBtn}>Cancel</button>
              <button
                onClick={submitPaymentReconcile}
                disabled={busy === "reconcile_payment"}
                className={styles.confirmBtn}
              >
                {busy === "reconcile_payment" ? "Reconciling..." : "Confirm Bank Remittance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
