"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import styles from "./landing.module.css";

const STATIONS = [
  {
    n: "01",
    badge: "INGESTION & REGISTRY",
    headline: "Automated Invoice & Tax Registry Validation",
    description:
      "Captures failed collection webhooks from Razorpay and validates debtor tax credentials against GSTIN and MSME Udyam registries to establish statutory limitation timelines.",
    telemetry: [
      { label: "DEBTOR ENTERPRISE", value: "Apex Heavy Electricals Ltd." },
      { label: "GSTIN", value: "27AABCA1234F1Z8", highlight: true },
      { label: "MSME STATUS", value: "Registered (Small Enterprise)" },
      { label: "E-INVOICE IRN", value: "IRN-4429-DEL-2026", sub: "Valid on NIC Portal" },
    ],
    verdict: {
      status: "TAX REGISTRY VERIFIED",
      color: "var(--color-recovered)",
      label: "Statutory 45-day clock initiated from invoice acceptance date.",
    },
  },
  {
    n: "02",
    badge: "GATEWAY ERROR INTELLIGENCE",
    headline: "Official Razorpay Error Code Diagnosis",
    description:
      "Maps raw payment failures against 38 official Razorpay taxonomy codes across UPI, Netbanking, and e-Mandate rails to separate technical friction from insolvency.",
    telemetry: [
      { label: "GATEWAY ERROR CODE", value: "BAD_REQUEST_ERROR", highlight: true },
      { label: "INTERNAL REASON", value: "payment_failed_due_to_insufficient_funds" },
      { label: "PAYMENT RAIL", value: "UPI / Auto-Debit Mandate" },
      { label: "RECOMMENDED ACTION", value: "Switch Rail to Corporate RTGS / Instant QR" },
    ],
    verdict: {
      status: "RECOVERABLE INTENT",
      color: "var(--accent)",
      label: "Non-terminal bank decline. Alternate payment rail required.",
    },
  },
  {
    n: "03",
    badge: "CALIBRATED ML SCORING",
    headline: "Tabular GBDT Recovery Probability",
    description:
      "Evaluates debtor credit risk tier, historical payment velocity, and invoice dispute history using a calibrated Gradient-Boosted Decision Tree model.",
    telemetry: [
      { label: "RECOVERY PROBABILITY", value: "78%", highlight: true },
      { label: "RISK CLASSIFICATION", value: "Tier 2 (Moderate Credit Risk)" },
      { label: "P2P ADHERENCE RATE", value: "91% Historical" },
      { label: "RECOMMENDED TACTIC", value: "Structured WhatsApp Promise Request" },
    ],
    verdict: {
      status: "OPTIMAL RECOVERY TIER",
      color: "var(--color-recovered)",
      label: "High confidence autonomous engagement permitted by policy.",
    },
  },
  {
    n: "04",
    badge: "STATE MACHINE ORCHESTRATION",
    headline: "Strict Finite State Machine Trajectory",
    description:
      "All state transitions are deterministic, audited, and enforce optimistic concurrency locking to prevent conflicting parallel recovery actions.",
    telemetry: [
      { label: "CURRENT STATE", value: "AWAITING_RESPONSE", highlight: true },
      { label: "ACTOR TYPE", value: "SYSTEM_AUTONOMOUS" },
      { label: "VERSION LOCK", value: "v4 (Optimistic Concurrency)" },
      { label: "NEXT LEGAL STATE", value: "PROMISE_RECORDED or ESCALATED" },
    ],
    verdict: {
      status: "CONCURRENCY VALIDATED",
      color: "var(--color-recovered)",
      label: "Audit log entry hashed and sealed in PostgreSQL/SQLite.",
    },
  },
  {
    n: "05",
    badge: "HINGLISH NLP EXTRACTION",
    headline: "Code-Mixed Financial Promise Extraction",
    description:
      "Trained on L3Cube-HingCorpus, our NLP engine extracts legally binding commitments from informal Hindi-English WhatsApp messages.",
    telemetry: [
      { label: "RAW COMMUNICATION", value: "“Kal shaam 4 baje 1.8L RTGS kar denge pakka”" },
      { label: "EXTRACTED AMOUNT", value: "₹1,80,000.00 INR", highlight: true },
      { label: "PROMISED DATE", value: "Friday 16:00 IST" },
      { label: "CODE-SWITCH CONFIDENCE", value: "96.4% Intent Strength" },
    ],
    verdict: {
      status: "BINDING COMMITMENT RECORDED",
      color: "var(--color-recovered)",
      label: "Automated T-1 day reminder queued for 09:00 IST calling window.",
    },
  },
  {
    n: "06",
    badge: "STATUTORY LEGAL DEMAND",
    headline: "Section 43B(h) & 138 NI Notice Dispatch",
    description:
      "When promises lapse or statutory cure windows expire, generates legally admissible notice drafts under Income Tax Act Sec 43B(h) and MSMED Act Sec 16.",
    telemetry: [
      { label: "NOTICE FORMAT", value: "MSME Sec 43B(h) Tax Disallowance Notice" },
      { label: "STATUTORY PENAL INTEREST", value: "₹8,420 (3× RBI Bank Rate @ 20.25%)" },
      { label: "CURE WINDOW", value: "7 Calendar Days" },
      { label: "LEGAL EXPOSURE", value: "31.2% Corporate Tax Disallowance" },
    ],
    verdict: {
      status: "STATUTORY NOTICE GENERATED",
      color: "var(--color-disallowed)",
      label: "Notice signed with tamper-evident SHA-256 digest.",
    },
  },
  {
    n: "07",
    badge: "PAYMENT RECONCILIATION",
    headline: "Section 194C/J TDS & Bank UTR Remittance",
    description:
      "Matches inward RTGS/NEFT UTR numbers and reconciles Form 16A withholding tax deductions to close cases without false dispute escalation.",
    telemetry: [
      { label: "BANK UTR MATCH", value: "UTR20260901849204" },
      { label: "FORM 16A ACK", value: "ACK-2026-Q4-0098 (2% Sec 194C)" },
      { label: "NET SETTLEMENT", value: "₹1,76,400 Received + ₹3,600 TDS" },
      { label: "FINAL STATUS", value: "CASE FULLY RECOVERED" },
    ],
    verdict: {
      status: "LEDGER RECONCILED",
      color: "var(--color-recovered)",
      label: "Debtor marked clear. Full immutable audit trail closed.",
    },
  },
];

const COMPLIANCE_RULES = [
  {
    rule: "MSME Section 43B(h) 45-Day Disallowance",
    mandate: "Income Tax Act, 1961 & MSMED Act, 2006",
    action: "Automated cure alert dispatched at T-15 and T-5 days before fiscal cutoff.",
    status: "ENFORCED IN CODE",
  },
  {
    rule: "RBI Master Direction Calling Hours",
    mandate: "Reserve Bank of India Guidelines, 2023",
    action: "Engine locks outbound calls and SMS outside 08:00–19:00 IST timezone.",
    status: "ENFORCED IN CODE",
  },
  {
    rule: "RBI Anti-Nagging Frequency Limit",
    mandate: "Fair Practices Code for Commercial Lenders",
    action: "Hard cutoff at maximum 3 contact attempts per rolling 7-day period.",
    status: "ENFORCED IN CODE",
  },
  {
    rule: "Section 194C / 194J TDS Deduction Guard",
    mandate: "Central Board of Direct Taxes (CBDT)",
    action: "Allows Form 16A certificate reconciliation without defaulting the invoice balance.",
    status: "ENFORCED IN CODE",
  },
];

export default function Landing() {
  const [activeStationIndex, setActiveStationIndex] = useState(0);
  const activeStation = STATIONS[activeStationIndex];

  return (
    <div className={styles.page}>
      {/* ── Top Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <Link href="/" className={styles.brandMark}>
            VAADA <span className={styles.brandDevanagari}>वादा</span>
          </Link>
          <span className={styles.brandTagline}>Bounded B2B Revenue Recovery</span>
        </div>
        <nav className={styles.mastheadNav}>
          <a href="#pipeline" className={styles.navLink}>Pipeline</a>
          <a href="#compliance" className={styles.navLink}>Compliance</a>
          <Link href="/razorpay-taxonomy" className={styles.navLink}>Taxonomy</Link>
          <Link href="/queue" className={styles.consoleBtn}>
            Operations Console →
          </Link>
        </nav>
      </header>

      {/* ── Hero Section ── */}
      <section className={styles.heroSection}>
        <div className={styles.heroBadge}>
          <span className={styles.heroDot} />
          <span>STATUTORY REVENUE RECOVERY FOR INDIAN ENTERPRISE</span>
        </div>

        <h1 className={styles.heroTitle}>
          Recover Revenue Without Losing Trust.
        </h1>

        <p className={styles.heroSubtitle}>
          Transform informal debtor promises into structured, legally compliant financial reality.
          Classify payment failures with official Razorpay taxonomy, extract Hinglish WhatsApp commitments,
          and enforce Section 43B(h) statutory clocks in code.
        </p>

        <div className={styles.heroActions}>
          <Link href="/queue" className={styles.primaryCta}>
            Launch Operations Console →
          </Link>
          <a href="#pipeline" className={styles.secondaryCta}>
            Inspect Machine Pipeline ↓
          </a>
        </div>

        {/* Telemetry Strip */}
        <div className={styles.telemetryStrip}>
          <div className={styles.telemetryItem}>
            <span className={styles.stripLabel}>STATUTORY RAILS</span>
            <span className={styles.stripValue}>MSME 43B(h) Active</span>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.stripLabel}>PENAL INTEREST</span>
            <span className={styles.stripValue}>3× RBI Bank Rate</span>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.stripLabel}>TAXONOMY</span>
            <span className={styles.stripValue}>38 Razorpay Codes</span>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.stripLabel}>LINGUISTIC ENGINE</span>
            <span className={styles.stripValue}>L3Cube HingCorpus</span>
          </div>
        </div>
      </section>

      {/* ── Section: Interactive 7-Station Pipeline ── */}
      <section id="pipeline" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>DETERMINISTIC SPARK</span>
          <h2 className={styles.sectionTitle}>Seven-Station Recovery Pipeline</h2>
          <p className={styles.sectionSubtitle}>
            Every overdue invoice advances through a rigorous, auditable state machine with zero hallucination.
          </p>
        </div>

        <div className={styles.pipelineLayout}>
          {/* Station Selector Tabs */}
          <div className={styles.stationTabs}>
            {STATIONS.map((st, idx) => (
              <button
                key={st.n}
                onClick={() => setActiveStationIndex(idx)}
                className={`${styles.stationTab} ${
                  activeStationIndex === idx ? styles.stationTabActive : ""
                }`}
              >
                <span className={styles.stationNum}>{st.n}</span>
                <span className={styles.stationTabName}>{st.badge}</span>
              </button>
            ))}
          </div>

          {/* Active Station Card */}
          <div className={styles.stationCard}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStation.n}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={styles.stationBody}
              >
                <div className={styles.stationHeaderRow}>
                  <div>
                    <span className={styles.cardStationBadge}>{activeStation.badge}</span>
                    <h3 className={styles.cardStationTitle}>{activeStation.headline}</h3>
                  </div>
                  <span className={styles.cardStationIndex}>STATION {activeStation.n}</span>
                </div>

                <p className={styles.cardStationDesc}>{activeStation.description}</p>

                {/* Telemetry Grid */}
                <div className={styles.stationTelemetryGrid}>
                  {activeStation.telemetry.map((item, i) => (
                    <div
                      key={i}
                      className={`${styles.stationMetric} ${
                        item.highlight ? styles.stationMetricHighlight : ""
                      }`}
                    >
                      <span className={styles.metricLabel}>{item.label}</span>
                      <span className={styles.metricValue}>{item.value}</span>
                      {item.sub && <span className={styles.metricSub}>{item.sub}</span>}
                    </div>
                  ))}
                </div>

                {/* Verdict Strip */}
                <div className={styles.verdictBox}>
                  <div className={styles.verdictStatus} style={{ color: activeStation.verdict.color }}>
                    {activeStation.verdict.status}
                  </div>
                  <div className={styles.verdictExplanation}>{activeStation.verdict.label}</div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Stepper Controls */}
            <div className={styles.cardFooterNav}>
              <button
                disabled={activeStationIndex === 0}
                onClick={() => setActiveStationIndex((prev) => Math.max(0, prev - 1))}
                className={styles.stepperBtn}
              >
                ← Previous
              </button>
              <span className={styles.stepperCount}>
                Station {activeStation.n} of 07
              </span>
              <button
                disabled={activeStationIndex === STATIONS.length - 1}
                onClick={() => setActiveStationIndex((prev) => Math.min(STATIONS.length - 1, prev + 1))}
                className={styles.stepperBtn}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section: Compliance Guardrails Ledger ── */}
      <section id="compliance" className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTag}>STATUTORY INTEGRITY</span>
          <h2 className={styles.sectionTitle}>Statutory Rules Enforced in Code</h2>
          <p className={styles.sectionSubtitle}>
            Hard-coded compliance guardrails that prevent aggressive harassment, ensure legal admissibility, and protect merchant relationships.
          </p>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.complianceTable}>
            <thead>
              <tr>
                <th>Statutory Rule</th>
                <th>Regulatory Reference</th>
                <th>Automated System Action</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {COMPLIANCE_RULES.map((row, idx) => (
                <tr key={idx}>
                  <td className={styles.ruleNameCell}>{row.rule}</td>
                  <td className={styles.ruleMandateCell}>{row.mandate}</td>
                  <td className={styles.ruleActionCell}>{row.action}</td>
                  <td className={styles.ruleStatusCell}>
                    <span className={styles.statusBadge}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Institutional Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <h3 className={styles.footerTitle}>Enter the Operations Console</h3>
            <p className={styles.footerDesc}>
              Inspect prioritized debtor dossiers, evaluate Razorpay diagnostic payloads, and execute compliant recovery actions.
            </p>
          </div>
          <Link href="/login" className={styles.footerCta}>
            Access Console →
          </Link>
        </div>

        <div className={styles.footerBottom}>
          <div>VAADA वादा · Bounded B2B Revenue Recovery Platform</div>
          <div>BUILT FOR INDIAN ENTERPRISES & MSMEs · IST TIMEZONE ENFORCED</div>
        </div>
      </footer>
    </div>
  );
}
