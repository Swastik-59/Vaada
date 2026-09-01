"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import gsap from "gsap";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<string, string> = {
  open: "OPEN", classified: "CLASSIFIED",
  awaiting_action: "AWAITING ACTION", contacted: "CONTACTED",
  awaiting_response: "AWAITING REPLY", promise_recorded: "PROMISE RECORDED",
  human_review: "HUMAN REVIEW", paused: "PAUSED",
  blocked: "BLOCKED", recovered: "RECOVERED",
  unrecoverable: "UNRECOVERABLE", cancelled: "CANCELLED",
};

const CAUSE_LABELS: Record<string, string> = {
  insufficient_funds: "Insufficient funds", mandate_failed: "Mandate failed",
  bank_decline: "Bank decline", network_error: "Network error",
  customer_dispute: "Customer dispute", invoice_mismatch: "Invoice mismatch",
  card_expired: "Card expired", unstructured_text: "Unstructured text",
  unknown: "Unknown cause",
};

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function fmtTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function probClass(p: number): string {
  return p >= 0.6 ? "high" : p >= 0.35 ? "med" : "low";
}

// ── Station 05: Promise extraction reveal ─────────────────────────────────────

function PromiseReveal({
  promise,
  langAnalysis,
}: {
  promise: Promise_ | null;
  langAnalysis?: CaseData["language_analysis"];
}) {
  const [showSignals, setShowSignals] = useState(true);
  const fieldsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const els = fieldsRef.current.filter(Boolean) as HTMLDivElement[];
    if (els.length === 0) return;
    gsap.fromTo(
      els,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.1, delay: 0.1 }
    );
  }, [promise?.raw_text]);

  if (!promise && !langAnalysis) {
    return (
      <p className={styles.noPromise}>
        No customer reply ingested yet. Use &ldquo;Send reminder&rdquo; in the sidebar to advance this case through the contact flow.
      </p>
    );
  }

  const rupees = promise?.amount_minor ? (promise.amount_minor / 100).toLocaleString("en-IN") : "—";
  const pct = Math.round((promise?.confidence || langAnalysis?.confidence || 0.85) * 100);
  const confColor = pct >= 80 ? "#3a9b65" : pct >= 55 ? "#c8891a" : "#c02020";

  const rawText = promise?.raw_text || langAnalysis?.raw_text || "";
  const langName = (langAnalysis?.language || promise?.language_mix || "hinglish").toUpperCase();
  const hiRatio = Math.round((langAnalysis?.hindi_ratio || 0.6) * 100);
  const enRatio = Math.round((langAnalysis?.english_ratio || 0.4) * 100);
  const codeSwitched = langAnalysis?.code_switched ?? true;
  const intent = (langAnalysis?.intent || "promise_to_pay").toUpperCase().replace(/_/g, " ");
  const strength = (langAnalysis?.commitment_strength || "high").toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={styles.promiseReveal}>
        {/* Left: raw text + language ratio */}
        <div className={styles.rawTextPanel}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div className={styles.rawTextLabel}>Raw Customer Reply (Hinglish/English)</div>
            {codeSwitched && <span className={styles.codeSwitchBadge}>Code-Switching Detected</span>}
          </div>

          <pre className={styles.rawText}>{rawText}</pre>

          {promise?.is_broken && (
            <div style={{ marginTop: 8, color: "#f87171", fontFamily: "var(--mono)", fontSize: 11 }}>
              ⚠️ Commitment Date Elapsed (Vaada Khilafi recorded)
            </div>
          )}

          {/* Language Ratio Split Bar */}
          <div className={styles.ratioContainer} style={{ marginTop: 16 }}>
            <div className={styles.ratioLabels}>
              <span>Hindi: <strong style={{ color: "#f97316" }}>{hiRatio}%</strong></span>
              <span>Language: <strong style={{ color: "#4ade80" }}>{langName}</strong></span>
              <span>English: <strong style={{ color: "#38bdf8" }}>{enRatio}%</strong></span>
            </div>
            <div className={styles.ratioBar}>
              <div className={styles.ratioHindi} style={{ width: `${hiRatio}%` }} />
              <div className={styles.ratioEnglish} style={{ width: `${enRatio}%` }} />
            </div>
          </div>
        </div>

        {/* Right: structured extraction results */}
        <div className={styles.extractedPanel}>
          <div className={styles.extractedLabel}>Structured Linguistic & Financial Extraction</div>
          
          <div
            className={styles.extractedField}
            ref={(el) => { fieldsRef.current[0] = el; }}
          >
            <div className={styles.extractedFieldLabel}>Amount promised</div>
            <div className={`${styles.extractedFieldValue} ${styles.accent}`}>
              {rupees !== "—" ? `₹${rupees}` : "Full Invoice Balance"}
            </div>
          </div>

          <div
            className={styles.extractedField}
            ref={(el) => { fieldsRef.current[1] = el; }}
          >
            <div className={styles.extractedFieldLabel}>Promised date / timeline</div>
            <div className={styles.extractedFieldValue}>
              {promise?.promised_date ? fmtDate(promise.promised_date) : "Friday"}
            </div>
          </div>

          <div
            className={styles.extractedField}
            ref={(el) => { fieldsRef.current[2] = el; }}
          >
            <div className={styles.extractedFieldLabel}>Classified Intent & Strength</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
              <span className={styles.intentTag}>{intent}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>
                Strength: <strong style={{ color: "#fff" }}>{strength}</strong>
              </span>
            </div>
          </div>

          <div
            className={styles.extractedField}
            ref={(el) => { fieldsRef.current[3] = el; }}
          >
            <div className={styles.extractedFieldLabel}>Confidence</div>
            <div
              className={styles.extractedFieldValue}
              style={{ color: confColor }}
            >
              {pct}%
            </div>
            <div className={styles.confBar}>
              <div
                className={styles.confFill}
                style={{ width: `${pct}%`, background: confColor }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Language Signals Inspector */}
      {langAnalysis && (langAnalysis.hindi_signals?.length > 0 || langAnalysis.english_signals?.length > 0) && (
        <div className={styles.langSignalsBox}>
          <div className={styles.langSignalsHeader}>
            <span className={styles.langSignalsTitle}>Linguistic Signal Lexicon & Explainability</span>
            <button
              onClick={() => setShowSignals(!showSignals)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {showSignals ? "Hide Signals ▲" : "Show Signals ▼"}
            </button>
          </div>

          {showSignals && (
            <div className={styles.signalsGrid}>
              <div className={styles.signalColumn}>
                <span className={styles.signalColumnTitle}>Hindi Tokens & Morphological Signals:</span>
                <div className={styles.signalChips}>
                  {langAnalysis.hindi_signals.map((sig) => (
                    <span key={sig} className={styles.hindiChip}>
                      &ldquo;{sig}&rdquo;
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.signalColumn}>
                <span className={styles.signalColumnTitle}>English Tokens & Commercial Signals:</span>
                <div className={styles.signalChips}>
                  {langAnalysis.english_signals.map((sig) => (
                    <span key={sig} className={styles.englishChip}>
                      &ldquo;{sig}&rdquo;
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Station 06: Compliance panel ──────────────────────────────────────────────

function CompliancePanel({ checks }: { checks: ComplianceCheck[] }) {
  if (checks.length === 0) {
    return <p className={styles.noCompliance}>No compliance evaluation recorded yet. Trigger &ldquo;Send reminder&rdquo; to evaluate.</p>;
  }
  const latest = checks[0];
  let results: RuleResult[] = [];
  try { results = JSON.parse(latest.results_json); } catch { /* ignore */ }

  return (
    <>
      <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--muted)" }}>
          Evaluated {fmtDate(latest.created_at)} · {latest.action_type}
        </span>
        <span
          className={`${styles.passLabel} ${latest.decision === "ALLOW" ? styles.pass : styles.fail}`}
        >
          {latest.decision}
        </span>
      </div>
      <table className={styles.complianceTable}>
        <thead>
          <tr>
            <th>Check</th>
            <th>Detail</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.rule_id}>
              <td>
                <div className={styles.ruleTitle}>{r.title}</div>
              </td>
              <td>
                <div className={styles.ruleDetail}>{r.detail}</div>
              </td>
              <td>
                <span className={`${styles.passLabel} ${r.passed ? styles.pass : styles.fail}`}>
                  {r.passed ? "PASS" : "FAIL"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TERMINAL_STATES = new Set(["recovered", "unrecoverable", "cancelled"]);
const CAN_SEND_REMINDER = new Set(["awaiting_action", "awaiting_response"]);

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("Operator paused automated contact.");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Drawer states
  const [showNoticeGen, setShowNoticeGen] = useState(false);
  const [noticeType, setNoticeType] = useState("msme_43b_h");
  const [showTDSModal, setShowTDSModal] = useState(false);
  const [tdsRate, setTdsRate] = useState("2.0");
  const [form16aAck, setForm16aAck] = useState("ACK-2026-Q4-0098");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payUtr, setPayUtr] = useState("UTR" + Math.floor(1000000000 + Math.random() * 9000000000));
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("2.0");

  const [copiedUpi, setCopiedUpi] = useState(false);
  const stationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stateRef = useRef<HTMLSpanElement>(null);

  async function load() {
    const payload = await apiFetch(`/api/v1/cases/${params.id}`);
    setData(payload);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [params.id]);

  // Station entrance animation
  useLayoutEffect(() => {
    if (!data) return;
    const els = stationRefs.current.filter(Boolean) as HTMLDivElement[];
    gsap.from(els, {
      x: -24,
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
      stagger: 0.07,
    });
  }, [!!data]);

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
      const newCase: CaseData = payload.case;
      setData(newCase);
      setActionSuccess(`Action ${action} completed successfully.`);
      if (stateRef.current) {
        gsap.fromTo(stateRef.current,
          { opacity: 0, scaleX: 0.85 },
          { opacity: 1, scaleX: 1, duration: 0.3, ease: "power2.out" }
        );
      }
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
      setActionSuccess(`Statutory notice ${noticeType} generated.`);
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
      setActionSuccess("TDS successfully reconciled.");
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
      setActionSuccess("Payment successfully recorded.");
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
      setActionSuccess("Promise adherence evaluated.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Adherence check failed");
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className={styles.shell}>
        <p className={styles.loading} style={{ color: "#c02020" }}>{error}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className={styles.shell}>
        <p className={styles.loading}>LOADING CASE…</p>
      </div>
    );
  }

  const isTerminal = TERMINAL_STATES.has(data.state);
  const canRemind = CAN_SEND_REMINDER.has(data.state);
  const prob = data.recovery_probability;
  const probPct = prob !== null ? Math.round(prob * 100) : null;
  const pc = prob !== null ? probClass(prob) : "med";

  const stateNodes: string[] = ["open"];
  data.decision_trace.forEach((t) => {
    if (!stateNodes.includes(t.to_state)) stateNodes.push(t.to_state);
  });

  const latestPromise = data.promises.length > 0 ? data.promises[data.promises.length - 1] : null;

  let eventPayload: Record<string, string> = {};
  if (data.event?.payload_json) {
    try { eventPayload = JSON.parse(data.event.payload_json); } catch { /* ignore */ }
  }

  const stat = data.statutory_status;

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.navMark}>VAADA / OPS CONSOLE • INDIA B2B</span>
        <div className={styles.navLinks}>
          <Link href="/queue">← Queue</Link>
          <Link href="/audit">Audit trail</Link>
          <Link href="/settings">Compliance config</Link>
          <Link href="/razorpay-taxonomy">Error Intelligence</Link>
        </div>
      </nav>

      <div className={styles.body}>
        {/* ── MAIN: Seven stations ── */}
        <main className={styles.main}>
          {/* Case header */}
          <header className={styles.caseHeader}>
            <p className={styles.caseId}>CASE {data.id}</p>
            <h1 className={styles.caseTitle}>{data.invoice_number ?? "Unknown invoice"}</h1>
            <div className={styles.caseMeta}>
              <span className={styles.caseMetaItem}>
                Customer: <strong>{data.customer?.display_name ?? "—"}</strong>
              </span>
              <span className={styles.caseMetaItem}>
                Principal: <strong>
                  {data.amount_minor != null
                    ? `₹${(data.amount_minor / 100).toLocaleString("en-IN")}`
                    : "—"}
                </strong>
              </span>
              {data.net_payable_minor != null && data.net_payable_minor !== data.amount_minor && (
                <span className={styles.caseMetaItem} style={{ color: "#38bdf8" }}>
                  Net Payable: <strong>₹{(data.net_payable_minor / 100).toLocaleString("en-IN")}</strong>
                </span>
              )}
              <span className={styles.caseMetaItem}>
                Due: <strong>{fmtDate(data.due_at)}</strong>
              </span>
              <span className={styles.caseMetaItem}>
                Risk Tier: <strong style={{ color: data.credit_risk_tier === "CRITICAL" ? "#f87171" : "#fbbf24" }}>
                  {data.credit_risk_tier ?? "MEDIUM"}
                </strong>
              </span>
              <span className={styles.caseMetaItem}>
                Version: <strong>v{data.version}</strong>
              </span>
            </div>
          </header>

          {/* 01 EVENT IN & TAX REGISTRY */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[0] = el; }}
          >
            <div className={styles.stationIndex}>01</div>
            <div className={styles.stationBody}>
              <h2 className={styles.stationTitle}>Event In & Tax Registry</h2>
              <div className={styles.eventGrid}>
                <div className={styles.eventField}>
                  <span className={styles.fieldLabel}>GSTIN</span>
                  <span className={styles.fieldValue} style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>
                    {data.customer?.gstin ?? "UNREGISTERED"}
                  </span>
                </div>
                <div className={styles.eventField}>
                  <span className={styles.fieldLabel}>MSME Category</span>
                  <span className={styles.fieldValue}>
                    {data.customer?.is_msme ? `Registered (${data.customer.msme_category || "Micro"})` : "Non-MSME"}
                  </span>
                </div>
                <div className={styles.eventField}>
                  <span className={styles.fieldLabel}>Udyam Reg Number</span>
                  <span className={styles.fieldValue} style={{ fontFamily: "var(--mono)" }}>
                    {data.customer?.udyam_reg_number ?? "—"}
                  </span>
                </div>
                <div className={styles.eventField}>
                  <span className={styles.fieldLabel}>E-Invoice IRN</span>
                  <span className={styles.fieldValue} style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                    {data.invoice?.e_invoice_irn ?? "—"}
                  </span>
                </div>
                <div className={styles.eventField}>
                  <span className={styles.fieldLabel}>Dispute / Deduction</span>
                  <span className={styles.fieldValue}>
                    {data.invoice?.dispute_status === "tds_deducted" ? "TDS Deducted (Sec 194C/J)" : (data.invoice?.dispute_status || "None")}
                  </span>
                </div>
                <div className={styles.eventField}>
                  <span className={styles.fieldLabel}>Event Source</span>
                  <span className={styles.fieldValue}>{data.event?.source ?? "synthetic"}</span>
                </div>
              </div>
            </div>
            <div className={styles.stationOwner}>INGEST</div>
          </div>

          {/* 02 PAYMENT DIAGNOSIS & RECOVERY INTELLIGENCE */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[1] = el; }}
          >
            <div className={styles.stationIndex}>02</div>
            <div className={styles.stationBody}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h2 className={styles.stationTitle} style={{ margin: 0 }}>Payment Diagnosis & Recovery Intelligence</h2>
                <Link
                  href="/razorpay-taxonomy"
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "#38bdf8",
                    textDecoration: "none",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    padding: "3px 8px",
                  }}
                >
                  Razorpay Explorer ↗
                </Link>
              </div>

              <div className={styles.diagnosisContainer}>
                {/* ── Official Published Razorpay Diagnosis ── */}
                <div className={styles.diagBox}>
                  <div className={styles.diagBoxHeader}>
                    <h3 className={styles.diagBoxTitle}>01. PAYMENT DIAGNOSIS</h3>
                    <span className={styles.diagOfficialBadge}>
                      {data.payment_diagnosis?.matched ? "OFFICIAL PUBLISHED TAXONOMY" : "UNMAPPED ERROR"}
                    </span>
                  </div>

                  {!data.payment_diagnosis?.matched && (
                    <div className={styles.unmappedBanner}>
                      ⚠️ <strong>UNMAPPED RAZORPAY ERROR</strong>: This failure payload does not match any official published Razorpay error code. Zero-hallucination policy applied; case flagged for manual operator review.
                    </div>
                  )}

                  <div className={styles.diagGrid}>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Payment Method</span>
                      <span className={styles.diagFieldVal}>
                        {data.payment_diagnosis?.payment_method?.toUpperCase() ?? "UPI"}
                      </span>
                    </div>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Razorpay Error Code</span>
                      <span className={styles.diagFieldVal} style={{ color: "#f87171" }}>
                        {data.payment_diagnosis?.code ?? "BAD_REQUEST_ERROR"}
                      </span>
                    </div>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Failure Reason</span>
                      <span className={styles.diagFieldVal}>
                        {data.payment_diagnosis?.reason ?? data.root_cause ?? "unknown"}
                      </span>
                    </div>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Source / Step</span>
                      <span className={styles.diagFieldVal}>
                        {data.payment_diagnosis?.source ?? "customer"} / {data.payment_diagnosis?.step ?? "payment_initiation"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className={styles.diagFieldKey}>Official Description:</span>
                    <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--paper)" }}>
                      {data.payment_diagnosis?.description ?? "No official description available for this unmapped failure."}
                    </p>
                  </div>

                  {data.payment_diagnosis?.official_next_step && (
                    <div className={styles.officialCallout}>
                      <strong style={{ display: "block", marginBottom: 2, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
                        Official Next Step:
                      </strong>
                      {data.payment_diagnosis.official_next_step}
                    </div>
                  )}

                  {data.payment_diagnosis?.official_source_url && (
                    <a
                      href={data.payment_diagnosis.official_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.officialLink}
                    >
                      <span>View official Razorpay documentation</span>
                      <span>↗</span>
                    </a>
                  )}
                </div>

                {/* ── Derived Vaada Recovery Intelligence ── */}
                <div className={styles.diagBox} style={{ borderColor: "rgba(56, 189, 248, 0.3)" }}>
                  <div className={styles.diagBoxHeader}>
                    <h3 className={styles.diagBoxTitle}>02. RECOVERY INTERPRETATION</h3>
                    <span className={styles.diagDerivedBadge}>VAADA RECOVERY LOGIC (DERIVED)</span>
                  </div>

                  <div className={styles.diagGrid}>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Recoverability</span>
                      <span className={styles.diagFieldVal} style={{
                        color: data.recovery_interpretation?.recoverability === "recoverable" ? "#4ade80" : (data.recovery_interpretation?.recoverability === "unrecoverable" ? "#f87171" : "#fbbf24"),
                        textTransform: "uppercase"
                      }}>
                        {data.recovery_interpretation?.recoverability ?? "RECOVERABLE"}
                      </span>
                    </div>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Retryable</span>
                      <span className={styles.diagFieldVal}>
                        {data.recovery_interpretation?.retryable ? "YES (Instant Retry)" : "NO (Switch Rail)"}
                      </span>
                    </div>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Urgency</span>
                      <span className={styles.diagFieldVal} style={{ textTransform: "uppercase" }}>
                        {data.recovery_interpretation?.urgency ?? "MEDIUM"}
                      </span>
                    </div>
                    <div className={styles.diagField}>
                      <span className={styles.diagFieldKey}>Human Review</span>
                      <span className={styles.diagFieldVal}>
                        {data.recovery_interpretation?.requires_human_review ? "REQUIRED" : "AUTOMATED"}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <span className={styles.diagFieldKey}>Policy Decision & Recommended Action:</span>
                    <div style={{
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid var(--line)",
                      padding: "10px 14px",
                      marginTop: 6,
                    }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>
                        POLICY: {data.recovery_interpretation?.policy_decision ?? "SEND_RETRY_PROMPT"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--paper)", lineHeight: 1.45 }}>
                        {data.recovery_interpretation?.merchant_action ?? "Deliver automated payment retry prompt."}
                      </div>
                    </div>
                  </div>

                  {/* ── Visual Decision Trace Chain ── */}
                  {data.decision_chain && data.decision_chain.length > 0 && (
                    <div className={styles.decisionChainContainer}>
                      <div className={styles.decisionChainTitle}>
                        END-TO-END REASONING TRACE (DIAGNOSIS → CUSTOMER CONTEXT → ACTION)
                      </div>
                      <div className={styles.chainList}>
                        {data.decision_chain.map((step, idx) => (
                          <div key={idx} className={styles.chainStep}>
                            <span className={styles.chainIndex}>0{idx + 1}</span>
                            <div>
                              <span className={styles.chainLabel}>{step.label}:</span>
                              <span className={styles.chainDetails}>{step.details}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.stationOwner}>DIAGNOSE & RECOVER</div>
          </div>

          {/* 03 PROBABILITY */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[2] = el; }}
          >
            <div className={styles.stationIndex}>03</div>
            <div className={styles.stationBody}>
              <h2 className={styles.stationTitle}>Probability, classical</h2>
              {probPct !== null ? (
                <>
                  <div className={styles.probDisplay}>
                    <span className={`${styles.probBigNum} ${styles[pc] || ""}`}>{probPct}%</span>
                    <div className={styles.probBarBig}>
                      <div className={`${styles.probFillBig} ${styles[pc] || ""}`} style={{ width: `${probPct}%` }} />
                    </div>
                  </div>
                  <p className={styles.probMeta}>
                    Tabular ML Scorer — cause weight × amount × DPD days × prior contacts.
                    {probPct < 25 && " Below 25% threshold → human review required."}
                  </p>
                </>
              ) : (
                <p className={styles.probMeta}>Recovery probability not yet scored.</p>
              )}
            </div>
            <div className={styles.stationOwner}>SCORE</div>
          </div>

          {/* 04 DAG & P2P ADHERENCE */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[3] = el; }}
          >
            <div className={styles.stationIndex}>04</div>
            <div className={styles.stationBody}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 className={styles.stationTitle}>DAG & P2P Lifecycle</h2>
                <button
                  style={{
                    fontFamily: "var(--mono)", fontSize: 10, background: "transparent",
                    border: "1px solid var(--line)", color: "var(--muted)", padding: "3px 8px", cursor: "pointer",
                  }}
                  onClick={checkPromiseAdherence}
                  disabled={busy === "check_adherence"}
                >
                  {busy === "check_adherence" ? "Evaluating…" : "🔄 Check P2P Adherence"}
                </button>
              </div>

              {/* Broken commitment banner if any */}
              {Boolean(data.p2p_broken_count && data.p2p_broken_count > 0) && (
                <div style={{
                  padding: "8px 12px", background: "rgba(192, 32, 32, 0.15)", borderLeft: "3px solid #c02020",
                  marginBottom: 12, fontFamily: "var(--mono)", fontSize: 11, color: "#ff8080"
                }}>
                  ⚠️ Broken Commitment Count: {data.p2p_broken_count} attempts. Credit risk tier escalated.
                </div>
              )}

              <div className={styles.statePath}>
                {stateNodes.map((s, i) => (
                  <span key={s} style={{ display: "inline-flex", alignItems: "center" }}>
                    <span
                      className={`${styles.stateNode} ${s === data.state ? styles.current : ""}`}
                    >
                      {STATE_LABELS[s] ?? s.toUpperCase()}
                    </span>
                    {i < stateNodes.length - 1 && (
                      <span className={styles.stateArrow}>→</span>
                    )}
                  </span>
                ))}
              </div>
              <div className={styles.transitionList}>
                {data.decision_trace.map((t, i) => (
                  <div key={i} className={styles.transitionItem}>
                    <span className={styles.transitionTime}>{fmtTime(t.created_at)}</span>
                    <span className={styles.transitionReason}>
                      {t.from_state} → {t.to_state}: {t.reason}
                      {t.score !== null && ` (score: ${(t.score * 100).toFixed(1)}%)`}
                    </span>
                    <span className={styles.transitionActor}>{t.actor_type}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.stationOwner}>ORCHESTRATE</div>
          </div>

          {/* 05 EXTRACT & CHANNELS */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[4] = el; }}
          >
            <div className={styles.stationIndex}>05</div>
            <div className={styles.stationBody}>
              <h2 className={styles.stationTitle}>वादा & Channels</h2>
              <PromiseReveal promise={latestPromise} langAnalysis={data.language_analysis} />

              {/* WhatsApp Interactive Message Box */}
              {data.whatsapp_payload && (
                <div className={styles.whatsappCard}>
                  <div className={styles.waHeader}>
                    <span>💬 WhatsApp Business Cloud API Simulation</span>
                    <span style={{ fontSize: 10, color: "#4ade80", fontFamily: "var(--mono)" }}>● Verified HSM</span>
                  </div>
                  <div className={styles.waBody}>
                    {data.whatsapp_payload.preview_data.body}
                  </div>
                  <div className={styles.waFooter}>
                    Interactive Actions Attached:
                  </div>
                  <div className={styles.waButtonGroup}>
                    <button className={styles.waButton} onClick={() => {
                      if (data.upi_payload?.upi_intent_uri) {
                        navigator.clipboard.writeText(data.upi_payload.upi_intent_uri);
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }
                    }}>
                      💳 Pay ₹{((data.net_payable_minor || data.amount_minor || 0) / 100).toLocaleString("en-IN")} via UPI {copiedUpi && "✓"}
                    </button>
                    <button className={styles.waButton}>
                      📅 Promise Commitment
                    </button>
                    <button className={styles.waButton}>
                      📄 Dispute / TDS Statement
                    </button>
                  </div>
                </div>
              )}

              {/* Dynamic UPI & VAN details */}
              {data.upi_payload && (
                <div className={styles.upiCard}>
                  <div className={styles.upiDetails}>
                    <span className={styles.upiLabel}>NPCI Dynamic UPI Handle</span>
                    <span className={styles.upiValue}>{data.upi_payload.vpa}</span>
                    <span className={styles.upiLabel}>Dedicated Corporate VAN (ICICI Virtual Account)</span>
                    <span className={styles.upiValue}>{data.upi_payload.van}</span>
                    <span className={styles.upiIntentUri}>{data.upi_payload.upi_intent_uri}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <button
                      className={styles.btnOutline}
                      style={{ padding: "6px 10px", fontSize: 11 }}
                      onClick={() => {
                        if (data.upi_payload?.upi_intent_uri) {
                          navigator.clipboard.writeText(data.upi_payload.upi_intent_uri);
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 2000);
                        }
                      }}
                    >
                      {copiedUpi ? "Copied UPI Link ✓" : "Copy UPI Intent"}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.stationOwner}>EXTRACT / RAILS</div>
          </div>

          {/* 06 STATUTORY POWERSTATION */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[5] = el; }}
          >
            <div className={styles.stationIndex}>06</div>
            <div className={styles.stationBody}>
              <h2 className={styles.stationTitle}>Statutory & Legal Power-Station</h2>
              
              {/* MSME & 43B(h) Card */}
              <div className={styles.statutoryCard}>
                <div className={styles.statGrid}>
                  <div className={styles.statMetric}>
                    <span className={styles.statLabel}>Section 43B(h) Countdown</span>
                    {stat ? (
                      <span className={`${styles.statBigVal} ${stat.is_disallowed ? styles.disallowed : (stat.days_remaining <= 5 ? styles.disallowed : styles.safe)}`}>
                        {stat.is_disallowed ? "DISALLOWED" : `${stat.days_remaining} Days`}
                      </span>
                    ) : <span>—</span>}
                  </div>
                  <div className={styles.statMetric}>
                    <span className={styles.statLabel}>3x RBI Statutory Interest</span>
                    <span className={`${styles.statBigVal} ${styles.interest}`}>
                      ₹{(((stat?.statutory_interest_minor || data.statutory_interest_minor) || 0) / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className={styles.statMetric}>
                    <span className={styles.statLabel}>Est. Corporate Tax Exposure</span>
                    <span className={`${styles.statBigVal} ${styles.disallowed}`}>
                      ₹{((stat?.tax_disallowance_exposure_minor || 0) / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {stat?.is_disallowed && (
                  <div className={styles.taxRiskNotice}>
                    ⚠️ <strong>Section 43B(h) Tax Disallowance Active:</strong> Expense cannot be claimed for tax deduction in the buyer&apos;s return until actual payment is cleared.
                  </div>
                )}
              </div>

              {/* Compliance checks */}
              <CompliancePanel checks={data.compliance} />

              {/* Generated Statutory Notices */}
              {data.notices.length > 0 && (
                <div className={styles.noticeList}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase" }}>
                    Issued Statutory Notices ({data.notices.length})
                  </div>
                  {data.notices.map((n) => (
                    <div key={n.id} className={styles.noticeItem}>
                      <div className={styles.noticeItemHeader}>
                        <span className={styles.noticeItemTitle}>{n.title}</span>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>
                          {n.statutory_reference}
                        </span>
                      </div>
                      <pre className={styles.noticeMarkdownPre}>{n.content_markdown}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.stationOwner}>STATUTORY</div>
          </div>

          {/* 07 RECONCILIATIONS & AUDIT */}
          <div
            className={styles.station}
            ref={(el) => { stationRefs.current[6] = el; }}
          >
            <div className={styles.stationIndex}>07</div>
            <div className={styles.stationBody}>
              <h2 className={styles.stationTitle}>Reconciliations & Audit Log</h2>

              {data.reconciliations.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                    SETTLEMENT & TDS RECONCILIATIONS
                  </div>
                  <table className={styles.complianceTable}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Reference</th>
                        <th>Amount</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.reconciliations.map((r) => (
                        <tr key={r.id}>
                          <td><span style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>{r.reconciliation_type}</span></td>
                          <td><span style={{ fontFamily: "var(--mono)" }}>{r.reference_number}</span></td>
                          <td><strong>₹{(r.amount_minor / 100).toLocaleString("en-IN")}</strong></td>
                          <td>{fmt(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className={styles.auditList}>
                {data.audit.length === 0 && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                    No audit events yet.
                  </span>
                )}
                {data.audit.slice(0, 10).map((a, i) => (
                  <div key={i} className={styles.auditItem}>
                    <span className={styles.auditTime}>{fmtTime(a.created_at)}</span>
                    <div>
                      <div className={styles.auditAction}>{a.action}</div>
                      <div className={styles.auditActor}>{a.actor_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.stationOwner}>AUDIT</div>
          </div>
        </main>

        {/* ── SIDEBAR ── */}
        <aside className={styles.sidebar}>
          {/* State */}
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarLabel}>Current state</p>
            <span
              ref={stateRef}
              className={`${styles.sideBadge} ${styles[data.state] || ""}`}
            >
              <span className={styles.sideBadgeDot} />
              {STATE_LABELS[data.state] ?? data.state.toUpperCase()}
            </span>
          </div>

          {/* Customer & Tax Details */}
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarLabel}>Buyer & Tax Profile</p>
            <div className={styles.sidebarField}>
              <span className={styles.sidebarFieldLabel}>Entity</span>
              <span className={styles.sidebarFieldValue}>{data.customer?.display_name ?? "—"}</span>
            </div>
            <div className={styles.sidebarField}>
              <span className={styles.sidebarFieldLabel}>GSTIN</span>
              <span className={styles.sidebarFieldValue} style={{ color: "var(--accent)" }}>
                {data.customer?.gstin ?? "—"}
              </span>
            </div>
            <div className={styles.sidebarField}>
              <span className={styles.sidebarFieldLabel}>MSME Status</span>
              <span className={styles.sidebarFieldValue}>
                {data.customer?.is_msme ? `Yes (${data.customer.msme_category})` : "No"}
              </span>
            </div>
          </div>

          {/* Invoice summary */}
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarLabel}>Invoice</p>
            <div className={styles.sidebarField}>
              <span className={styles.sidebarFieldLabel}>Number</span>
              <span className={styles.sidebarFieldValue}>{data.invoice_number ?? "—"}</span>
            </div>
            <div className={styles.sidebarField}>
              <span className={styles.sidebarFieldLabel}>Gross Amount</span>
              <span className={styles.sidebarAmount}>
                {data.amount_minor != null
                  ? `₹${(data.amount_minor / 100).toLocaleString("en-IN")}`
                  : "—"}
              </span>
            </div>
            {data.net_payable_minor != null && (
              <div className={styles.sidebarField}>
                <span className={styles.sidebarFieldLabel}>Net Payable</span>
                <span className={styles.sidebarAmount} style={{ color: "#38bdf8" }}>
                  ₹{(data.net_payable_minor / 100).toLocaleString("en-IN")}
                </span>
              </div>
            )}
            <div className={styles.sidebarField}>
              <span className={styles.sidebarFieldLabel}>Due date</span>
              <span className={styles.sidebarFieldValue}>{fmtDate(data.due_at)}</span>
            </div>
          </div>

          {/* Feedback toasts */}
          {actionSuccess && <p style={{ color: "#4ade80", fontFamily: "var(--mono)", fontSize: 11 }}>{actionSuccess}</p>}
          {actionError && <p className={styles.errorMsg}>{actionError}</p>}

          {/* Override controls */}
          {!isTerminal && (
            <div className={styles.sidebarSection}>
              <p className={styles.sidebarLabel}>Actions & Statutory Recovery</p>
              
              <div className={styles.actionBtns}>
                {canRemind && (
                  <button
                    className={styles.btnPrimary}
                    onClick={() => act("send_reminder")}
                    disabled={!!busy}
                  >
                    {busy === "send_reminder" && <span className={styles.spinner} />}
                    Send WhatsApp Reminder
                  </button>
                )}

                {/* Statutory Notice Generator Button */}
                <button
                  className={styles.btnOutline}
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                  onClick={() => setShowNoticeGen(!showNoticeGen)}
                >
                  ⚡ Generate Statutory Notice
                </button>

                {showNoticeGen && (
                  <div className={styles.actionDrawer}>
                    <span className={styles.sidebarFieldLabel}>Select Notice Type:</span>
                    <select
                      className={styles.inputField}
                      value={noticeType}
                      onChange={(e) => setNoticeType(e.target.value)}
                    >
                      <option value="msme_43b_h">Section 43B(h) Tax Disallowance Notice</option>
                      <option value="sec_138_ni_act">Section 138 NI Act Legal Demand Notice</option>
                      <option value="msme_samadhaan_form_1">MSME Samadhaan Form 1 Pre-Filing</option>
                      <option value="statement_of_account">Formal Statement of Account (SOA)</option>
                    </select>
                    <button
                      className={styles.btnPrimary}
                      onClick={generateStatutoryNotice}
                      disabled={busy === "generate_notice"}
                    >
                      {busy === "generate_notice" ? "Generating…" : "Draft & Dispatch Notice"}
                    </button>
                  </div>
                )}

                {/* TDS Reconciliation Button */}
                <button
                  className={styles.btnOutline}
                  onClick={() => setShowTDSModal(!showTDSModal)}
                >
                  📄 Reconcile TDS (Form 16A)
                </button>

                {showTDSModal && (
                  <div className={styles.actionDrawer}>
                    <span className={styles.sidebarFieldLabel}>TDS Rate (%):</span>
                    <input
                      className={styles.inputField}
                      type="number"
                      step="0.1"
                      value={tdsRate}
                      onChange={(e) => setTdsRate(e.target.value)}
                    />
                    <span className={styles.sidebarFieldLabel}>Form 16A Ack / Challan Ref:</span>
                    <input
                      className={styles.inputField}
                      type="text"
                      value={form16aAck}
                      onChange={(e) => setForm16aAck(e.target.value)}
                    />
                    <button
                      className={styles.btnPrimary}
                      onClick={submitTDSReconcile}
                      disabled={busy === "reconcile_tds"}
                    >
                      {busy === "reconcile_tds" ? "Saving…" : "Apply TDS Deduction"}
                    </button>
                  </div>
                )}

                {/* Record Payment Button */}
                <button
                  className={styles.btnOutline}
                  onClick={() => setShowPaymentModal(!showPaymentModal)}
                >
                  💰 Record Payment / UTR
                </button>

                {showPaymentModal && (
                  <div className={styles.actionDrawer}>
                    <span className={styles.sidebarFieldLabel}>Amount Paid (INR):</span>
                    <input
                      className={styles.inputField}
                      type="number"
                      placeholder="e.g. 50000"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <span className={styles.sidebarFieldLabel}>Bank UTR / UPI Ref:</span>
                    <input
                      className={styles.inputField}
                      type="text"
                      value={payUtr}
                      onChange={(e) => setPayUtr(e.target.value)}
                    />
                    <button
                      className={styles.btnPrimary}
                      onClick={submitPaymentReconcile}
                      disabled={busy === "reconcile_payment"}
                    >
                      {busy === "reconcile_payment" ? "Reconciling…" : "Confirm Remittance"}
                    </button>
                  </div>
                )}

                {/* Standard Workflow Buttons */}
                <button
                  className={styles.btnOutline}
                  onClick={() => act("pause")}
                  disabled={!!busy || data.state === "paused"}
                >
                  {busy === "pause" && <span className={styles.spinner} />}
                  Pause case
                </button>
                {data.state === "paused" && (
                  <button
                    className={styles.btnOutline}
                    onClick={() => act("resume")}
                    disabled={!!busy}
                  >
                    {busy === "resume" && <span className={styles.spinner} />}
                    Resume
                  </button>
                )}
                <button
                  className={styles.btnOutline}
                  onClick={() => act("escalate")}
                  disabled={!!busy || data.state === "human_review"}
                >
                  {busy === "escalate" && <span className={styles.spinner} />}
                  Escalate to review
                </button>
                <button
                  className={styles.btnOutline}
                  onClick={() => act("mark_recovered")}
                  disabled={!!busy}
                >
                  {busy === "mark_recovered" && <span className={styles.spinner} />}
                  Mark recovered
                </button>
                <button
                  className={styles.btnDanger}
                  onClick={() => act("mark_unrecoverable")}
                  disabled={!!busy}
                >
                  {busy === "mark_unrecoverable" && <span className={styles.spinner} />}
                  Mark unrecoverable
                </button>
              </div>
            </div>
          )}

          {isTerminal && (
            <div className={styles.sidebarSection}>
              <p className={styles.sidebarLabel}>Terminal state</p>
              <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                This case is in a terminal state. No further automated actions are possible.
              </p>
            </div>
          )}

          {/* Quick links */}
          <div className={styles.sidebarSection}>
            <p className={styles.sidebarLabel}>Navigation</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/queue" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)" }}>
                ← Back to queue
              </Link>
              <Link href="/audit" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)" }}>
                Full audit trail →
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
