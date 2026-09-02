"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motion, AnimatePresence } from "motion/react";
import styles from "./landing.module.css";

type StationTelemetry = {
  n: string;
  title: string;
  badge: string;
  headline: string;
  description: string;
  telemetry: {
    label: string;
    value: string;
    sub?: string;
    highlight?: boolean;
  }[];
  verdict: {
    status: string;
    label: string;
    color: string;
  };
};

const STATIONS: StationTelemetry[] = [
  {
    n: "01",
    title: "EVENT INGESTION",
    badge: "STATION 01 · INGEST",
    headline: "Decline payload enters from Razorpay rails",
    description:
      "A failed corporate collection or mandate decline arrives via webhook. Ingestion deduplicates the idempotency key, attaches customer GSTIN, and retrieves MSME Udyam registration status.",
    telemetry: [
      { label: "EVENT ID", value: "evt_rzp_9842f7c01" },
      { label: "INVOICE NUMBER", value: "INV-2026-9042" },
      { label: "PRINCIPAL AMOUNT", value: "₹1,80,000.00", highlight: true },
      { label: "SUPPLIER STATUS", value: "MSME Micro (Udyam Verified)" },
    ],
    verdict: { status: "INGESTED", label: "Payload Authenticated & Deduplicated", color: "var(--color-recovered)" },
  },
  {
    n: "02",
    title: "ROOT CAUSE TAXONOMY",
    badge: "STATION 02 · CLASSIFY",
    headline: "Deterministic lookup in 38-code official taxonomy",
    description:
      "No generative hallucination. Exact matching across Razorpay's published error taxonomy separates official gateway error descriptions from Vaada's derived recovery policies.",
    telemetry: [
      { label: "RAZORPAY CODE", value: "BAD_REQUEST_ERROR" },
      { label: "FAILURE REASON", value: "insufficient_funds" },
      { label: "PAYMENT METHOD", value: "UPI / Corporate Mandate" },
      { label: "RECOVERABILITY", value: "HIGH (Retryable Rail)", highlight: true },
    ],
    verdict: { status: "RECOVERABLE", label: "Root Cause Matched · Zero Hallucination", color: "var(--color-recovered)" },
  },
  {
    n: "03",
    title: "CALIBRATED ML SCORING",
    badge: "STATION 03 · SCORE",
    headline: "Tabular GBDT estimates recovery probability",
    description:
      "A classical calibrated gradient-boosted tree—not a text LLM—evaluates invoice age, buyer credit tier, statutory penalty rate, and prior contact history to output a rigorous probability.",
    telemetry: [
      { label: "RECOVERY PROBABILITY", value: "78.4%", highlight: true },
      { label: "CREDIT RISK TIER", value: "TIER 2 (Commercial Moderate)" },
      { label: "INVOICE AGE", value: "14 Days Past Due" },
      { label: "RECOMMENDED ACTION", value: "Automated WhatsApp Intent Outreach" },
    ],
    verdict: { status: "P(REC) = 0.78", label: "Exceeds Human Intervention Threshold", color: "var(--color-warning)" },
  },
  {
    n: "04",
    title: "DETERMINISTIC DAG",
    badge: "STATION 04 · ORCHESTRATE",
    headline: "State transitions governed by formal graph constraints",
    description:
      "The next action is an edge in a finite state machine: retry, contact, escalate, or freeze. Maximum attempt limits and statutory countdown limits are enforced as hard code constraints.",
    telemetry: [
      { label: "PREVIOUS STATE", value: "open" },
      { label: "NEXT STATE", value: "awaiting_action", highlight: true },
      { label: "OPTIMISTIC LOCK", value: "Version Check: v1 -> v2" },
      { label: "EXECUTION ACTOR", value: "SYSTEM_DAG_WORKFLOW" },
    ],
    verdict: { status: "STATE COMMITTED", label: "Transition Verified Without Side-Effects", color: "var(--color-recovered)" },
  },
  {
    n: "05",
    title: "HINGLISH P2P EXTRACTION",
    badge: "STATION 05 · EXTRACT",
    headline: "L3Cube-HingCorpus model structures informal commitment",
    description:
      "WhatsApp and phone transcripts like 'Sir kal shaam 4 baje 1.8L clear kar dunga pakka' are parsed into verified promise schema: amount, timestamp, confidence, and code-mixed token ratio.",
    telemetry: [
      { label: "RAW TRANSCRIPT", value: "“Kal shaam 4 baje 1.8L RTGS kar denge pakka”" },
      { label: "EXTRACTED PROMISE", value: "₹1,80,000.00 @ Friday 16:00 IST", highlight: true },
      { label: "CONFIDENCE SCORE", value: "94.2% (High Semantic Certainty)" },
      { label: "LANGUAGE RATIO", value: "62% Hindi · 38% English (Code-Switched)" },
    ],
    verdict: { status: "वादा RECORDED", label: "Binding Financial Promise Scheduled", color: "var(--color-recovered)" },
  },
  {
    n: "06",
    title: "REGULATORY COMPLIANCE RAILS",
    badge: "STATION 06 · COMPLY",
    headline: "RBI Fair Practices Code & Section 43B(h) hard limits",
    description:
      "Every outbound communication passes mandatory statutory filters. Contact hour (08:00–19:00 IST), rolling 7-day frequency caps, sender identity disclosure, and harassment prohibitions.",
    telemetry: [
      { label: "CONTACT WINDOW", value: "14:32 IST · Within Legal Window (08:00–19:00)", highlight: true },
      { label: "ROLLING 7-DAY FREQUENCY", value: "Attempt 1 of 3 (Cap Enforced)" },
      { label: "IDENTITY DISCLOSURE", value: "Verified Sender Header & PAN/GSTIN" },
      { label: "HARASSMENT TONE CHECK", value: "100% Passed (FPC Standard Compliant)" },
    ],
    verdict: { status: "ALLOW", label: "Outbound Verified Lawful Under Indian Law", color: "var(--color-recovered)" },
  },
  {
    n: "07",
    title: "RECOVERY & RECONCILIATION",
    badge: "STATION 07 · SETTLE",
    headline: "Dynamic NPCI UPI intent & Form 16A TDS reconciliation",
    description:
      "The debtor receives a real-time NPCI UPI intent link and virtual corporate account number (VAN). Remittance matches bank UTR, handles TDS deductions with Form 16A certificates, and halts statutory countdowns.",
    telemetry: [
      { label: "UPI INTENT LINK", value: "upi://pay?pa=vaada.icici@corp&am=180000.00" },
      { label: "BANK REMITTANCE UTR", value: "UTR9832746182 (Verified RTGS Inward)", highlight: true },
      { label: "TDS CERTIFICATE", value: "Form 16A ACK-2026-Q4 Reconciled" },
      { label: "STATUTORY DISALLOWANCE", value: "Section 43B(h) Risk Extinguished" },
    ],
    verdict: { status: "RECOVERED", label: "₹1,80,000 In Bank Account · Ledger Finalized", color: "var(--color-recovered)" },
  },
];

const LEDGER_RULES = [
  {
    rule: "Contact window limit (08:00–19:00 IST)",
    mandate: "Reserve Bank of India (RBI) Fair Practices Code for Lenders & Recovery Agents",
    failureMode: "Outbound blocked instantly; message queued for legal slot next business morning",
    status: "ENFORCED IN CODE",
    statusType: "pass",
  },
  {
    rule: "Rolling 7-day frequency cap (Max 3 contacts)",
    mandate: "RBI Master Direction on Digital Recovery & Fair Practices",
    failureMode: "Automated engine locks; case escalates to manual operator review",
    status: "ENFORCED IN CODE",
    statusType: "pass",
  },
  {
    rule: "Mandatory sender identity & debt verification",
    mandate: "Consumer Protection Act 2019 & Indian Contract Act",
    failureMode: "Outbound template invalidated; dispatch refused by gateway adapter",
    status: "ENFORCED IN CODE",
    statusType: "pass",
  },
  {
    rule: "Income Tax Act Section 43B(h) Disallowance Clock",
    mandate: "Finance Act 2023 (15/45-day MSME Supplier Settlement)",
    failureMode: "Tax disallowance exposure (~31.2%) calculated; formal legal notice issued",
    status: "ACTIVE ENGINE",
    statusType: "pass",
  },
  {
    rule: "MSMED Act Section 16 (3× RBI Bank Rate Interest)",
    mandate: "Micro, Small & Medium Enterprises Development Act 2006",
    failureMode: "Compounded monthly interest accrued daily and appended to recovery statement",
    status: "ACTIVE ENGINE",
    statusType: "pass",
  },
  {
    rule: "Anti-harassment language & tone audit",
    mandate: "RBI Debt Recovery Guidelines & Judicial Precedents",
    failureMode: "Outbound message rejected if aggressive or threatening tokens detected",
    status: "ENFORCED IN CODE",
    statusType: "pass",
  },
];

export default function Landing() {
  const rootRef = useRef<HTMLElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const [activeStationIndex, setActiveStationIndex] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    gsap.registerPlugin(ScrollTrigger);

    // Hero typography reveal
    gsap.from(".heroChar", {
      yPercent: 120,
      opacity: 0,
      rotateX: -20,
      duration: 1.1,
      stagger: 0.05,
      ease: "power3.out",
    });

    gsap.from(".heroSub", {
      opacity: 0,
      y: 24,
      duration: 0.9,
      delay: 0.4,
      stagger: 0.1,
      ease: "power2.out",
    });

    // Pinned interactive pipeline progression
    if (pipelineRef.current) {
      ScrollTrigger.create({
        trigger: pipelineRef.current,
        start: "top top",
        end: "+=2800",
        pin: true,
        scrub: 0.6,
        onUpdate: (self) => {
          const step = Math.min(
            STATIONS.length - 1,
            Math.floor(self.progress * STATIONS.length)
          );
          setActiveStationIndex(step);
        },
      });
    }

    return () => {
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  const activeStation = STATIONS[activeStationIndex];

  return (
    <main ref={rootRef} className={styles.site}>
      {/* ── Top Technical Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.mastheadBrand}>
          <span className={styles.brandMark}>VAADA</span>
          <span className={styles.brandDevanagari}>वादा</span>
          <span className={styles.brandDivider}>/</span>
          <span className={styles.brandSub}>REVENUE RECOVERY AGENT</span>
        </div>
        <div className={styles.mastheadStatus}>
          <span className={styles.pulseDot} />
          <span>RBI FPC ENGINE ARMED</span>
          <span className={styles.statusDivider}>·</span>
          <span>RAZORPAY TAXONOMY 2026-09</span>
          <span className={styles.statusDivider}>·</span>
          <span>MSME 43B(H) ACTIVE</span>
        </div>
        <nav className={styles.mastheadNav}>
          <a href="#pipeline">Machine</a>
          <a href="#rules">Compliance Ledger</a>
          <Link href="/login" className={styles.consoleLink}>
            <span>Operator Console</span>
            <span className={styles.linkArrow}>↗</span>
          </Link>
        </nav>
      </header>

      {/* ── Hero Editorial Moment ── */}
      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          {/* Vertical Technical Margin Spine */}
          <aside className={styles.heroSpine}>
            <span>NOT A GENERIC CHATBOT</span>
            <span className={styles.spineRule} />
            <span>NOT CARD RETRY SPAM</span>
            <span className={styles.spineRule} />
            <span>EXECUTABLE FINANCIAL LAW</span>
          </aside>

          {/* Hero Main Body */}
          <div className={styles.heroMain}>
            <div className={`${styles.heroKicker} heroSub`}>
              <span className={styles.kickerTag}>DOMESTIC B2B · INDIA</span>
              <span className={styles.kickerMeta}>
                DETERMINISTIC RAILS · ACADEMIC HINGLISH NLP · ZERO HALLUCINATION
              </span>
            </div>

            <h1 className={styles.heroHeadline} aria-label="VAADA">
              {"VAADA".split("").map((char, i) => (
                <span key={`${char}-${i}`} className="heroChar">
                  {char}
                </span>
              ))}
            </h1>

            <div className={`${styles.heroSubGrid} heroSub`}>
              <p className={styles.heroThesis}>
                Recover overdue B2B receivables by transforming code-mixed Hinglish promises into dated, legally structured commitments—enforced in code.
              </p>
              <div className={styles.heroContextBox}>
                <div className={styles.contextHeader}>THE INDIAN REALITY</div>
                <p>
                  In Indian commerce, late payments don&apos;t clear through automated email blasts. A merchant gets a WhatsApp message:
                  <em> “Kal shaam 4 baje 1.8L RTGS ho jayega.”</em>
                </p>
                <p>
                  That sentence is a binding promise. Traditional software leaves it as an unread note. Vaada extracts it, binds it to statutory clocks, and enforces RBI guardrails before touching the debtor.
                </p>
              </div>
            </div>

            <div className={`${styles.heroCtaBar} heroSub`}>
              <Link href="/login" className={styles.primaryCta}>
                <span>Enter Operations Console</span>
                <span className={styles.ctaIcon}>→</span>
              </Link>
              <a href="#pipeline" className={styles.secondaryCta}>
                <span>Inspect The 7-Station Machine</span>
                <span className={styles.ctaIcon}>↓</span>
              </a>
              <div className={styles.heroCredentialHint}>
                <span>Default Demo: <code>operator@vaada.local</code></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Indian B2B Gap: Split Section ── */}
      <section className={styles.gapSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIndex}>01 / ARCHITECTURE</span>
          <span className={styles.sectionTitle}>The Indian Receivable Gap</span>
          <span className={styles.sectionConstraint}>Domain Specialization</span>
        </div>

        <div className={styles.gapGrid}>
          <div className={styles.gapCard}>
            <div className={styles.gapCardNum}>01.A</div>
            <h3 className={styles.gapCardTitle}>Why Western AR Automation Fails in India</h3>
            <p className={styles.gapCardBody}>
              Western accounts-receivable platforms rely on automated dunning sequences, Stripe card re-attempts, and rigid formal emails. Indian B2B trade runs on credit terms, supply-chain disputes, Section 194C TDS deductions, and informal WhatsApp commitments.
            </p>
            <ul className={styles.gapList}>
              <li>Blind email reminders trigger recipient spam blocks, not payments.</li>
              <li>Credit cards are rarely used for B2B wholesale invoices; UPI & RTGS rule.</li>
              <li>Deductions (TDS, debit notes) are falsely flagged as defaults without Form 16A reconciliation.</li>
            </ul>
          </div>

          <div className={styles.gapCard}>
            <div className={styles.gapCardNum}>01.B</div>
            <h3 className={styles.gapCardTitle}>Why AI Chatbots Without Guardrails Destroy Trust</h3>
            <p className={styles.gapCardBody}>
              Generic generative AI chat agents invent payment terms, apologize inappropriately, hallucinate payment links, and violate RBI recovery guidelines by messaging outside legal hours or contacting unauthorized staff.
            </p>
            <ul className={styles.gapList}>
              <li>LLMs must never possess direct authority to issue payment demands.</li>
              <li>Payment error taxonomy must come from official gateway specs, not prompt memory.</li>
              <li>Every outbound communication must be pre-screened by deterministic statutory code.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── The 7-Station Machine: Interactive Pinned Telemetry Pipeline ── */}
      <section id="pipeline" ref={pipelineRef} className={styles.pipelineSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIndex}>02 / MACHINE PIPELINE</span>
          <span className={styles.sectionTitle}>Seven Stations · Deterministic Spine</span>
          <span className={styles.sectionConstraint}>Scrub Or Scroll To Advance</span>
        </div>

        <div className={styles.pipelineStage}>
          {/* Left: Interactive Navigation Rail */}
          <div className={styles.pipelineRail}>
            <div className={styles.pipelineRailLabel}>PIPELINE STATIONS</div>
            <div className={styles.stationList}>
              {STATIONS.map((station, idx) => (
                <button
                  key={station.n}
                  onClick={() => setActiveStationIndex(idx)}
                  className={`${styles.stationNavItem} ${
                    activeStationIndex === idx ? styles.stationNavActive : ""
                  }`}
                >
                  <span className={styles.stationNavNum}>{station.n}</span>
                  <span className={styles.stationNavTitle}>{station.title}</span>
                  {activeStationIndex === idx && (
                    <motion.span
                      layoutId="activeStationIndicator"
                      className={styles.activeStationIndicator}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className={styles.pipelineLiveTag}>
              <span className={styles.liveIndicatorDot} />
              <span>LIVE SIMULATION TELEMETRY</span>
              <div className={styles.liveInvoiceTag}>INVOICE: INV-2026-9042 · ₹1.80L</div>
            </div>
          </div>

          {/* Right: Dynamic Station Dossier Display */}
          <div className={styles.stationDisplay}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStation.n}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={styles.stationContent}
              >
                {/* Station Header */}
                <div className={styles.stationContentHeader}>
                  <div>
                    <span className={styles.stationBadge}>{activeStation.badge}</span>
                    <h2 className={styles.stationHeadline}>{activeStation.headline}</h2>
                  </div>
                  <div className={styles.stationBigIndex}>{activeStation.n}</div>
                </div>

                <p className={styles.stationDescription}>{activeStation.description}</p>

                {/* Telemetry Grid */}
                <div className={styles.telemetryGrid}>
                  {activeStation.telemetry.map((t, idx) => (
                    <div
                      key={idx}
                      className={`${styles.telemetryCard} ${
                        t.highlight ? styles.telemetryHighlight : ""
                      }`}
                    >
                      <span className={styles.telemetryLabel}>{t.label}</span>
                      <span className={styles.telemetryValue}>{t.value}</span>
                      {t.sub && <span className={styles.telemetrySub}>{t.sub}</span>}
                    </div>
                  ))}
                </div>

                {/* Machine Verdict Strip */}
                <div className={styles.verdictStrip}>
                  <div className={styles.verdictLeft}>
                    <span className={styles.verdictStatus} style={{ color: activeStation.verdict.color }}>
                      ● {activeStation.verdict.status}
                    </span>
                    <span className={styles.verdictLabel}>{activeStation.verdict.label}</span>
                  </div>
                  <div className={styles.verdictRight}>
                    <span>VERIFIED DETERMINISTIC STEP</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Step Controls */}
            <div className={styles.pipelineControls}>
              <button
                disabled={activeStationIndex === 0}
                onClick={() => setActiveStationIndex((prev) => Math.max(0, prev - 1))}
                className={styles.stepBtn}
              >
                ← Previous Station
              </button>
              <div className={styles.stepCounter}>
                STATION {activeStation.n} OF 07
              </div>
              <button
                disabled={activeStationIndex === STATIONS.length - 1}
                onClick={() => setActiveStationIndex((prev) => Math.min(STATIONS.length - 1, prev + 1))}
                className={styles.stepBtn}
              >
                Next Station →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Statutory Guardrails & Compliance Ledger ── */}
      <section id="rules" className={styles.ledgerSection}>
        <div className={styles.sectionHeading}>
          <span className={styles.sectionIndex}>03 / COMPLIANCE LEDGER</span>
          <span className={styles.sectionTitle}>Statutory Rules Enforced in Code</span>
          <span className={styles.sectionConstraint}>RBI & MSMED Rails</span>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.ledgerTable}>
            <thead>
              <tr>
                <th>Statutory Rule / Guardrail</th>
                <th>Regulatory Mandate</th>
                <th>Automated Enforcement Action</th>
                <th>Status in Engine</th>
              </tr>
            </thead>
            <tbody>
              {LEDGER_RULES.map((row, idx) => (
                <tr key={idx}>
                  <td className={styles.ruleCell}>
                    <span className={styles.ruleTitle}>{row.rule}</span>
                  </td>
                  <td className={styles.mandateCell}>{row.mandate}</td>
                  <td className={styles.actionCell}>{row.failureMode}</td>
                  <td className={styles.statusCell}>
                    <span className={styles.statusTagPass}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Institutional Footer & Operations Gateway ── */}
      <footer className={styles.footer}>
        <div className={styles.footerHero}>
          <h2 className={styles.footerHeadline}>
            Stop pretending automated nag-emails are revenue recovery.
          </h2>
          <p className={styles.footerSub}>
            Open the operations console to inspect live recovery cases, audit Razorpay error telemetry, analyze Hinglish WhatsApp commitments, and execute RBI-compliant recovery workflows.
          </p>
        </div>

        <div className={styles.footerGateway}>
          <div className={styles.gatewayCard}>
            <div className={styles.gatewayHeader}>OPERATOR ACCESS</div>
            <div className={styles.gatewayBody}>
              <p>
                The console is fully armed and connected to the local database. Seeded cases include real Indian B2B scenarios: MSME Section 43B(h) disallowance risks, Form 16A TDS reconciliations, and Razorpay UPI mandate failures.
              </p>
              <Link href="/login" className={styles.gatewayBtn}>
                <span>Enter Operations Console</span>
                <span>→</span>
              </Link>
            </div>
            <div className={styles.gatewayFooter}>
              <span>AUTHENTICATION: JWT · CSRF SECURED · ROLE-BASED ACCESS</span>
            </div>
          </div>
        </div>

        <div className={styles.footerBottomBar}>
          <div>VAADA / वादा · Bounded B2B Revenue Recovery</div>
          <div>BUILT FOR INDIAN ENTERPRISE & MSME SUPPLIERS</div>
          <div>LOCAL ENVIRONMENT · 08:00–19:00 IST TIMEZONE AWARE</div>
        </div>
      </footer>
    </main>
  );
}
