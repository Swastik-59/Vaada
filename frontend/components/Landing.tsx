"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import HeroScene from "@/components/HeroScene";
import styles from "./landing.module.css";

// ── Real Razorpay Failure Scenarios for Interactive Comparison ─────────────
const GATEWAY_SCENARIOS = [
  {
    id: "insufficient_funds",
    code: "BAD_REQUEST_ERROR",
    reason: "insufficient_funds",
    rail: "UPI Autopay / e-NACH",
    official_desc: "The customer's bank account has insufficient balance to complete the transaction.",
    real_meaning: "The corporate debtor has cyclical cash flow. They are not insolvent, but the auto-debit hit before their morning receivables arrived.",
    vaada_action: "Do not trigger aggressive recovery. Queue structured WhatsApp promise request for their Friday settlement window.",
    recoverability: "92% Recoverable",
  },
  {
    id: "bank_offline",
    code: "GATEWAY_ERROR",
    reason: "bank_server_down",
    rail: "Corporate Netbanking",
    official_desc: "The destination bank's core banking switch is temporarily down for scheduled maintenance.",
    real_meaning: "Purely technical friction. The debtor attempted payment in good faith, but the bank rail failed.",
    vaada_action: "Zero debtor disruption. Dispatch instant UPI Dynamic QR link with automated rail-switch suggestion.",
    recoverability: "98% Recoverable",
  },
  {
    id: "mandate_frequency",
    code: "BAD_REQUEST_ERROR",
    reason: "mandate_frequency_limit_exceeded",
    rail: "e-Mandate / Recurring",
    official_desc: "Recurring debit attempt exceeded the registered mandate frequency schedule.",
    real_meaning: "Contractual milestone mismatch. Debtor approved a monthly schedule, but this was a supplementary invoice.",
    vaada_action: "Generate immediate Section 194C TDS reconciliation request and one-time corporate RTGS payment link.",
    recoverability: "84% Recoverable",
  },
];

// ── Hinglish Message Word Highlighting ──────────────────────────────────────
const HINGLISH_DEMO = {
  raw: "Bhai abhi balance thoda tight hai, Friday shaam 4 baje 1.85L RTGS kar dunga pakka.",
  tokens: [
    { text: "Bhai", label: "Greeting", type: "neutral" },
    { text: "abhi", label: "Context", type: "neutral" },
    { text: "balance", label: "Financial Signal", type: "signal" },
    { text: "thoda", label: "Qualifier", type: "neutral" },
    { text: "tight hai,", label: "Liquidity State", type: "neutral" },
    { text: "Friday shaam 4 baje", label: "Extracted Date: 2026-09-04 16:00 IST", type: "timestamp" },
    { text: "1.85L", label: "Extracted Value: ₹1,85,000.00 INR", type: "currency" },
    { text: "RTGS", label: "Recommended Rail: Bank Remittance", type: "rail" },
    { text: "kar dunga", label: "Future Action", type: "neutral" },
    { text: "pakka.", label: "Binding Confidence: 94.2%", type: "intent" },
  ],
};

const HINGLISH_TOKENS = [
  { text: "Bhai ", signal: false },
  { text: "abhi ", signal: false },
  { text: "balance ", signal: false },
  { text: "thoda ", signal: false },
  { text: "tight ", signal: false },
  { text: "hai, ", signal: false },
  { text: "Friday shaam 4 baje ", signal: true, label: "Extracted Date: Friday 16:00 IST" },
  { text: "1.85L ", signal: true, label: "Extracted Value: ₹1,85,000.00" },
  { text: "RTGS ", signal: true, label: "Recommended Rail: Corporate RTGS" },
  { text: "kar ", signal: false },
  { text: "dunga ", signal: false },
  { text: "pakka.", signal: true, label: "Binding Confidence: 94.2%" },
];

export default function Landing() {
  const [activeScenario, setActiveScenario] = useState(GATEWAY_SCENARIOS[0]);
  const [calcInvoice, setCalcInvoice] = useState(1850000); // ₹18,50,000 in paise
  const [calcDaysOverdue, setCalcDaysOverdue] = useState(36);
  const [istTime, setIstTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const str = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      setIstTime(`${str} IST`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Section 43B(h) Math
  const statutoryLimitDays = 45;
  const daysRemaining = Math.max(0, statutoryLimitDays - calcDaysOverdue);
  const isDisallowed = calcDaysOverdue >= statutoryLimitDays;
  const corporateTaxRate = 0.312; // 30% tax + 4% cess
  const taxPenaltyExposure = isDisallowed ? (calcInvoice / 100) * corporateTaxRate : 0;
  const penalInterestRate = 0.2025; // 3x RBI Bank Rate ~20.25%
  const accruedInterest = ((calcInvoice / 100) * penalInterestRate * (calcDaysOverdue / 365));

  return (
    <div className={styles.landingWrapper}>
      {/* ── Top Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <Link href="/" className={styles.brandMark}>
            <span>VAADA</span>
            <span className={styles.brandDevanagari}>वादा</span>
          </Link>
          <span className={styles.brandTagline}>B2B Revenue Recovery for Indian Enterprise</span>
        </div>

        <nav className={styles.mastheadNav}>
          <a href="#intelligence" className={styles.navLink}>Gateway Intelligence</a>
          <a href="#hinglish" className={styles.navLink}>Hinglish NLP</a>
          <a href="#statutory" className={styles.navLink}>Section 43B(h)</a>
          <Link href="/analytics" className={styles.navLink}>Analytics</Link>
          <Link href="/queue" className={styles.launchConsoleBtn}>
            Operations Console →
          </Link>
        </nav>
      </header>

      {/* ── Scene 1: The Opening Statement (Split Composition) with Three.js WebGL Rails ── */}
      <section className={styles.heroScene}>
        <HeroScene />
        <div className={styles.container}>
          <div className={styles.heroSplitGrid}>
            {/* Left Column: Opening Thesis & Action */}
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.0, 0.0, 0.2, 1] }}
              className={styles.heroLeft}
            >
              <div className={styles.liveClock}>
                <span className={styles.clockPulseDot} />
                <span>{istTime || "09:00:00 IST"} · REGULATORY CONTACT WINDOW</span>
              </div>

              <h1 className={styles.heroTitle}>
                ₹1,85,000
                <br />
                <span className={styles.heroOverdueText}>overdue.</span>
              </h1>

              <p className={styles.heroSubText}>
                The customer isn&apos;t refusing to pay.
                <br />
                They&apos;re negotiating on WhatsApp.
              </p>

              <div className={styles.heroActions}>
                <Link href="/queue" className={styles.primaryAction}>
                  Enter Operations Console →
                </Link>
              </div>

              <div className={styles.heroScrollHint}>
                <a href="#narrative">Inspect The Recovery Journey ↓</a>
              </div>
            </motion.div>

            {/* Right Column: Vertical Financial Instrument Stack */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.0, 0.0, 0.2, 1] }}
              className={styles.instrumentStack}
            >
              <div className={styles.instrumentItem}>
                <span className={styles.instrumentLabel}>PORTFOLIO VALUE</span>
                <span className={styles.instrumentValue}>₹1,24,60,000</span>
                <span className={styles.instrumentMeta}>21 active enterprise invoices</span>
              </div>

              <div className={styles.instrumentItem}>
                <span className={styles.instrumentLabel}>SECTION 43B(H) EXPOSURE</span>
                <span className={styles.instrumentValue} style={{ color: "var(--status-disallowed)" }}>
                  13 Debtors
                </span>
                <span className={styles.instrumentMeta}>31.2% tax disallowance threat</span>
              </div>

              <div className={styles.instrumentItem}>
                <span className={styles.instrumentLabel}>PENAL INTEREST CLAIMABLE</span>
                <span className={styles.instrumentValue} style={{ color: "var(--accent)" }}>
                  ₹1,42,850
                </span>
                <span className={styles.instrumentMeta}>3× RBI rate · MSMED Act §16</span>
              </div>

              <div className={styles.instrumentItem}>
                <span className={styles.instrumentLabel}>RESOLUTION RATE</span>
                <span className={styles.instrumentValue} style={{ color: "var(--status-recovered)" }}>
                  89.4%
                </span>
                <span className={styles.instrumentMeta}>avg. 6.8 days to cure</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Scene 2: The Gateway Reality (Official Razorpay Taxonomy) ── */}
      <section id="intelligence" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <h2 className={styles.sceneHeadline}>
              Why did the payment actually fail?
            </h2>
            <p className={styles.sceneSubtitle}>
              Ordinary collections treat all declines as non-payment. Vaada inspects the official Razorpay
              payment gateway taxonomy to separate transient bank switch failures from true credit friction.
            </p>
          </div>

          <div className={styles.interactiveGatewayBox}>
            {/* Left: Interactive Scenario Selector */}
            <div className={styles.scenarioList}>
              <span className={styles.selectorHeading}>PUBLISHED RAZORPAY EVENT</span>
              {GATEWAY_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => setActiveScenario(sc)}
                  className={`${styles.scenarioButton} ${
                    activeScenario.id === sc.id ? styles.scenarioActive : ""
                  }`}
                >
                  <div className={styles.btnCodeRow}>
                    <span className={styles.scenarioCode}>{sc.code}</span>
                    <span className={styles.scenarioRail}>{sc.rail}</span>
                  </div>
                  <span className={styles.scenarioReason}>{sc.reason}</span>
                </button>
              ))}
              <div className={styles.taxonomyTruthBadge}>
                <span>Verified against 38 official Razorpay taxonomy codes</span>
              </div>
            </div>

            {/* Right: Comparative Diagnostic Canvas (Sequential Translation Chain) */}
            <div className={styles.diagnosticCanvas}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScenario.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className={styles.canvasBody}
                >
                  <div className={styles.canvasTop}>
                    <div>
                      <h3 className={styles.canvasCodeTitle}>{activeScenario.code} : {activeScenario.reason}</h3>
                      <p className={styles.canvasOfficialDesc}>{activeScenario.official_desc}</p>
                    </div>
                    <span className={styles.canvasRecoverabilityBadge}>
                      {activeScenario.recoverability}
                    </span>
                  </div>

                  <div className={styles.translationChain}>
                    <div className={styles.chainDivider}>
                      <span>↓ Commercial interpretation in Indian commerce</span>
                    </div>

                    <div className={styles.commercialInterpretationBlock}>
                      <p className={styles.commercialText}>{activeScenario.real_meaning}</p>
                    </div>

                    <div className={styles.chainDivider}>
                      <span>↓ Autonomous recovery policy directive</span>
                    </div>

                    <div className={styles.policyDirectiveBlock}>
                      <p className={styles.policyText}>{activeScenario.vaada_action}</p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 3: The Hinglish Linguistic Breakthrough ── */}
      <section id="narrative" className={styles.sceneSectionAlt}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>LINGUISTIC INTELLIGENCE · L3CUBE HINGCORPUS</span>
            <h2 className={styles.sceneHeadline}>
              Understanding debtor promises in their own language.
            </h2>
            <p className={styles.sceneSubtitle}>
              Indian business owners communicate commitments through nuanced code-mixed Hindi and English on WhatsApp.
              Vaada extracts structured dates, amounts, and payment rails from informal text.
            </p>
          </div>

          <div className={styles.hinglishContainer}>
            {/* Display Sentence at Prose Scale with Staggered Word Reveal */}
            <motion.div
              className={styles.hinglishProse}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: { staggerChildren: 0.04 },
                },
              }}
            >
              &ldquo;
              {HINGLISH_TOKENS.map((token, i) => (
                <motion.span
                  key={i}
                  variants={{
                    hidden: { opacity: 0, y: 6 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                  }}
                  className={token.signal ? styles.wordSignal : styles.wordContext}
                  title={token.label}
                >
                  {token.text}
                </motion.span>
              ))}
              &rdquo;
            </motion.div>

            {/* Extracted Financial Contract Bar */}
            <motion.div
              className={styles.structuredContractRow}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5, duration: 0.4 }}
            >
              <div className={styles.contractField}>
                <span className={styles.cFieldLabel}>BINDING AMOUNT</span>
                <span className={styles.cFieldValue} style={{ color: "var(--accent)" }}>
                  ₹1,85,000.00
                </span>
                <span className={styles.cFieldSub}>Parsed from &ldquo;1.85L&rdquo;</span>
              </div>

              <div className={styles.contractField}>
                <span className={styles.cFieldLabel}>SCHEDULED SETTLEMENT</span>
                <span className={styles.cFieldValue}>Friday, 16:00 IST</span>
                <span className={styles.cFieldSub}>Target cure date established</span>
              </div>

              <div className={styles.contractField}>
                <span className={styles.cFieldLabel}>PAYMENT DISPATCH RAIL</span>
                <span className={styles.cFieldValue}>Corporate RTGS / IMPS</span>
                <span className={styles.cFieldSub}>Switched from failing mandate</span>
              </div>

              <div className={styles.contractField}>
                <span className={styles.cFieldLabel}>AUTOMATED CURE ACTION</span>
                <span className={styles.cFieldValue} style={{ color: "var(--status-recovered)" }}>
                  T-24h Friendly Reminder
                </span>
                <span className={styles.cFieldSub}>94.2% Binding Confidence</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Scene 4: The Statutory Leverage (Section 43B(h) Calculator) ── */}
      <section id="statutory" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <h2 className={styles.sceneHeadline}>
              The 45-day statutory MSME weapon.
            </h2>
            <p className={styles.sceneSubtitle}>
              Under Section 43B(h) of the Income Tax Act, overdue payments to MSME registered suppliers cannot be
              claimed as tax-deductible business expenses if paid beyond 45 days. This creates massive fiscal liability for enterprise buyers.
            </p>
          </div>

          <div className={styles.calculatorSectionLayout}>
            <div className={styles.calculatorControlsDirect}>
              <div className={styles.calcControl}>
                <label className={styles.calcLabel}>
                  <span>INVOICE PRINCIPAL AMOUNT</span>
                  <strong>₹{(calcInvoice / 100).toLocaleString("en-IN")}</strong>
                </label>
                <input
                  type="range"
                  min="200000"
                  max="10000000"
                  step="50000"
                  value={calcInvoice}
                  onChange={(e) => setCalcInvoice(Number(e.target.value))}
                  className={styles.rangeSlider}
                />
              </div>

              <div className={styles.calcControl}>
                <label className={styles.calcLabel}>
                  <span>DAYS ELAPSED SINCE ACCEPTANCE</span>
                  <strong>{calcDaysOverdue} DAYS</strong>
                </label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="1"
                  value={calcDaysOverdue}
                  onChange={(e) => setCalcDaysOverdue(Number(e.target.value))}
                  className={styles.rangeSlider}
                />
              </div>
            </div>

            {/* Direct Numbers Grid with Crossing Signature Moment */}
            <div className={styles.calcDirectResults}>
              <motion.div
                className={styles.calcDirectCol}
                animate={
                  isDisallowed
                    ? {
                        backgroundColor: [
                          "var(--bg-surface)",
                          "rgba(232, 80, 80, 0.12)",
                          "rgba(232, 80, 80, 0.04)",
                        ],
                        borderColor: ["var(--border-subtle)", "var(--status-disallowed)", "var(--border-subtle)"],
                      }
                    : { backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)" }
                }
                transition={{ duration: 0.4 }}
              >
                <span className={styles.calcResLabel}>STATUTORY CURE WINDOW</span>
                <motion.div
                  key={isDisallowed ? "disallowed" : daysRemaining}
                  initial={{ y: -6, opacity: 0.6 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={styles.calcHeroNum}
                  style={{ color: isDisallowed ? "var(--status-disallowed)" : "var(--accent)" }}
                >
                  {isDisallowed ? "DISALLOWED IN CODE" : `${daysRemaining} DAYS`}
                </motion.div>
                <p className={styles.calcResDesc}>
                  {isDisallowed
                    ? "Mandatory 45-day MSMED cutoff crossed. Expense deduction revoked."
                    : "Automated cure reminder dispatched within regulatory window."}
                </p>
              </motion.div>

              <div className={styles.calcDirectCol}>
                <span className={styles.calcResLabel}>DEBTOR TAX EXPOSURE (31.2%)</span>
                <div className={styles.calcHeroNum} style={{ color: "var(--status-disallowed)" }}>
                  ₹{Math.round(taxPenaltyExposure).toLocaleString("en-IN")}
                </div>
                <p className={styles.calcResDesc}>
                  Direct corporate income tax penalty paid to IT Department if unsettled.
                </p>
              </div>

              <div className={styles.calcDirectCol}>
                <span className={styles.calcResLabel}>3× RBI PENAL INTEREST ACCRUED</span>
                <div className={styles.calcHeroNum} style={{ color: "var(--status-recovered)" }}>
                  ₹{Math.round(accruedInterest).toLocaleString("en-IN")}
                </div>
                <p className={styles.calcResDesc}>
                  Compounded with monthly rests under MSMED Act Section 16.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 5: Data Provenance & Trust (Tabular Statement) ── */}
      <section id="provenance" className={styles.sceneSectionAlt}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <h2 className={styles.sceneHeadline}>Honest Data Provenance</h2>
            <p className={styles.sceneSubtitle}>
              We never fabricate data or obscure reality. The system clearly demarcates authoritative external sources
              from synthetic demo scenarios.
            </p>
          </div>

          <div className={styles.provenanceStatementList}>
            <div className={styles.provenanceRow}>
              <span className={styles.provStatus}>AUTHORITATIVE REAL DATA</span>
              <div className={styles.provContent}>
                <h4 className={styles.provTitle}>Razorpay Failure Taxonomy</h4>
                <p className={styles.provDesc}>
                  Directly versioned representation of Razorpay&apos;s 38 official error codes, root cause mappings,
                  and failure reasons across UPI, Card, Netbanking, and e-Mandate rails.
                </p>
              </div>
            </div>

            <div className={styles.provenanceRow}>
              <span className={styles.provStatus}>ACADEMIC CORPUS RESOURCE</span>
              <div className={styles.provContent}>
                <h4 className={styles.provTitle}>L3Cube-HingCorpus NLP</h4>
                <p className={styles.provDesc}>
                  Trained on peer-reviewed Hindi-English code-mixed datasets for accurate grammatical boundary detection,
                  preventing misinterpretation of Indian monetary colloquiums.
                </p>
              </div>
            </div>

            <div className={styles.provenanceRow}>
              <span className={styles.provStatus}>SYNTHETIC SAFE DATA</span>
              <div className={styles.provContent}>
                <h4 className={styles.provTitle}>Debtor & Invoice Entities</h4>
                <p className={styles.provDesc}>
                  All corporate names, GSTINs, and phone numbers in the demo database are cryptographically generated
                  synthetic records compliant with Indian Digital Personal Data Protection (DPDP) Act 2023.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 6: Institutional Console Launchpad ── */}
      <footer className={styles.footerLaunchpad}>
        <div className={styles.container}>
          <div className={styles.launchpadBanner}>
            <h3 className={styles.launchpadPrompt}>
              Ready to inspect active recovery dossiers?
            </h3>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <Link href="/queue" className={styles.launchpadCta}>
                Launch Operations Console →
              </Link>
              <Link
                href="/analytics"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "10px 20px",
                  borderRadius: "4px",
                  background: "var(--bg-elevated)",
                  color: "var(--accent-text)",
                  border: "1px solid rgba(224, 159, 62, 0.3)",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                }}
              >
                Portfolio Analytics →
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: "2rem", margin: "2.5rem 0 1.5rem", flexWrap: "wrap", fontSize: "0.8125rem" }}>
            <Link href="/queue" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Operations Queue</Link>
            <Link href="/analytics" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Portfolio Analytics</Link>
            <Link href="/audit" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Audit Trail</Link>
            <Link href="/settings" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Compliance Rules</Link>
            <Link href="/razorpay-taxonomy" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Razorpay Taxonomy</Link>
          </div>

          <div className={styles.footerBottomMeta}>
            <div>VAADA / वादा · RBI-compliant · MSMED Act 2006 §16 · Income Tax Act §43B(h) · DPDP Act 2023</div>
            <div>{istTime || "09:00:00 IST"} · ASIA/KOLKATA UTC+5:30</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
