"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { motion, useScroll, useTransform } from "motion/react";
import styles from "./case.module.css";

// ── Types (Truncated for brevity, keeping only what's needed for the redesign) ──
type CaseData = any; // Assuming the same robust data structure as before

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function TechTrace({ title, json }: { title: string; json: any }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 24 }}>
      <button className={styles.techTraceToggle} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "View"} {title} Trace
      </button>
      {open && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={styles.techTraceContent}
        >
          <pre>{JSON.stringify(json, null, 2)}</pre>
        </motion.div>
      )}
    </div>
  );
}

export default function CasePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start center", "end center"],
  });

  async function loadCase() {
    const payload = await apiFetch(`/api/v1/cases/${params.id}`);
    setData(payload);
  }

  useEffect(() => {
    loadCase().catch((err) => setError(err.message));
  }, [params.id]);

  async function checkPromiseAdherence() {
    if (!data) return;
    setBusy("check_adherence");
    try {
      const res = await apiFetch(`/api/v1/cases/${params.id}/p2p/check-adherence`, { method: "POST" });
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
        <div className={styles.errorBanner}>{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.shell}>
        <div className={styles.loadingBanner}>Loading Dossier...</div>
      </div>
    );
  }

  const stat = data.statutory_status;
  const lang = data.language_analysis;
  const latestPromise = data.promises?.length > 0 ? data.promises[data.promises.length - 1] : null;

  return (
    <div className={styles.shell}>
      {/* Top Nav */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/queue" className={styles.navBackLink}>← QUEUE</Link>
          <span className={styles.navSlash}>/</span>
          <span className={styles.navInvoice}>{data.invoice_number ?? "UNKNOWN INVOICE"}</span>
        </div>
      </nav>

      {/* Hero Overview */}
      <section className={styles.caseHero}>
        <h1 className={styles.customerName}>{data.customer?.display_name ?? "Unknown Enterprise"}</h1>
        
        <div className={styles.financialSummary}>
          <div className={styles.finStat}>
            <span className={styles.finLabel}>Principal Recovery</span>
            <span className={styles.finValue}>₹{((data.amount_minor || 0) / 100).toLocaleString("en-IN")}</span>
          </div>
          <div className={styles.finStat}>
            <span className={styles.finLabel}>43B(h) Clock</span>
            <span className={styles.finValue} style={{ color: stat?.is_disallowed ? "var(--color-disallowed)" : "inherit" }}>
              {stat?.is_disallowed ? "DISALLOWED" : `${stat?.days_remaining ?? "N/A"} Days`}
            </span>
          </div>
          <div className={styles.finStat}>
            <span className={styles.finLabel}>ML Probability</span>
            <span className={styles.finValue} style={{ color: "var(--text-primary)" }}>
              {data.recovery_probability ? Math.round(data.recovery_probability * 100) : "--"}%
            </span>
          </div>
        </div>
      </section>

      {/* Status Banners */}
      {actionSuccess && <div className={styles.successBanner}>{actionSuccess}</div>}
      {actionError && <div className={styles.errorBanner}>{actionError}</div>}

      {/* Narrative Timeline */}
      <main className={styles.timelineContainer} ref={containerRef}>
        
        {/* Beat 1: The Failure Event */}
        <section className={styles.storyBeat}>
          <div className={styles.beatHeader}>
            <span className={styles.beatTime}>{fmtDate(data.event?.occurred_at)}</span>
            <h2 className={styles.beatTitle}>Gateway Collection Failed</h2>
          </div>
          <div className={styles.beatContent}>
            <p>An automated collection attempt on the Razorpay rails failed.</p>
            <p>Reason: <strong>{data.payment_diagnosis?.reason ?? data.root_cause ?? "Insufficient Funds"}</strong> via {data.payment_diagnosis?.payment_method ?? "Corporate Mandate"}.</p>
          </div>
          <TechTrace title="Razorpay Payload" json={data.payment_diagnosis?.raw_payload || {}} />
        </section>

        {/* Beat 2: The Magic Hinglish Moment */}
        {(lang || latestPromise) && (
          <section className={styles.storyBeat}>
            <div className={styles.beatHeader}>
              <span className={styles.beatTime}>AI Extraction</span>
              <h2 className={styles.beatTitle}>Human Intent Recognized</h2>
            </div>
            <div className={styles.beatContent}>
              <p>We intercepted an informal communication from the debtor. Our HingCorpus model processed the code-switched text and extracted a formal financial commitment.</p>
            </div>
            
            <div className={styles.hinglishWorkspace}>
              <motion.div 
                className={styles.rawMessage}
                style={{ 
                  opacity: useTransform(scrollYProgress, [0.3, 0.5, 0.6], [1, 1, 0.1]),
                  scale: useTransform(scrollYProgress, [0.3, 0.5], [1, 0.95])
                }}
              >
                “{lang?.raw_text || latestPromise?.raw_text || "Kal shaam 4 baje 1.8L RTGS kar denge pakka"}”
              </motion.div>

              <motion.div
                className={styles.structuredPromise}
                style={{
                  position: "absolute",
                  opacity: useTransform(scrollYProgress, [0.45, 0.6], [0, 1]),
                  y: useTransform(scrollYProgress, [0.45, 0.6], [40, 0])
                }}
              >
                <div className={styles.structuredLabel}>Binding Promise Extracted</div>
                <div>₹{((latestPromise?.amount_minor || data.amount_minor || 0)/100).toLocaleString("en-IN")} @ {fmtDate(latestPromise?.promised_date)}</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>
                  Confidence: {lang?.confidence ? Math.round(lang.confidence * 100) : 94}%
                </div>
              </motion.div>
            </div>
            
            <TechTrace title="NLP Analysis" json={lang || {}} />
          </section>
        )}

        {/* Beat 3: Statutory State */}
        <section className={styles.storyBeat}>
          <div className={styles.beatHeader}>
            <span className={styles.beatTime}>Current</span>
            <h2 className={styles.beatTitle}>Statutory Reality</h2>
          </div>
          <div className={styles.beatContent}>
            <p>The case is currently in state: <strong>{data.state.toUpperCase()}</strong>.</p>
            {stat?.is_msme && (
              <p>Under Section 43B(h), the tax disallowance exposure is ₹{((stat?.tax_disallowance_exposure_minor || 0)/100).toLocaleString("en-IN")}. 
              Statutory interest has accrued to ₹{((data.statutory_interest_minor || 0)/100).toLocaleString("en-IN")} at {stat?.interest_rate_percent}%.</p>
            )}
          </div>
          <TechTrace title="State Transition DAG" json={data.decision_trace || []} />
        </section>

      </main>

      {/* Action Bar */}
      <div className={styles.actionBar}>
        <button className={styles.actionBtn}>Generate Statutory Notice</button>
        <button className={styles.actionBtn}>Reconcile TDS</button>
        <button className={`${styles.actionBtn} ${styles.actionBtnPrimary}`} onClick={checkPromiseAdherence} disabled={busy === "check_adherence"}>
          {busy === "check_adherence" ? "Evaluating..." : "Check Promise Adherence"}
        </button>
      </div>

    </div>
  );
}
