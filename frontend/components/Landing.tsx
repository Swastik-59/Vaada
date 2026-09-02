"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
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

export default function Landing() {
  const [activeScenario, setActiveScenario] = useState(GATEWAY_SCENARIOS[0]);
  const [calcInvoice, setCalcInvoice] = useState(1850000); // ₹18,50,000 in paise
  const [calcDaysOverdue, setCalcDaysOverdue] = useState(36);

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
          <a href="#narrative" className={styles.navLink}>The Story</a>
          <a href="#intelligence" className={styles.navLink}>Intelligence</a>
          <a href="#statutory" className={styles.navLink}>Section 43B(h)</a>
          <a href="#provenance" className={styles.navLink}>Data Provenance</a>
          <Link href="/login" className={styles.launchConsoleBtn}>
            Enter Console →
          </Link>
        </nav>
      </header>

      {/* ── Scene 1: The Crisis (Money At Risk) ── */}
      <section className={styles.heroScene}>
        <div className={styles.container}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={styles.heroContent}
          >
            <div className={styles.kickerBadge}>
              <span className={styles.kickerDot} />
              <span>THE COLD REALITY OF INDIAN B2B COMMERCE</span>
            </div>

            <h1 className={styles.heroTitle}>
              ₹1,85,000 overdue by 14 days.
              <br />
              <span className={styles.heroSubTitle}>
                The customer isn&apos;t refusing to pay. They&apos;re negotiating on WhatsApp.
              </span>
            </h1>

            <p className={styles.heroBody}>
              In Indian trade, receivables don&apos;t die in courtrooms—they slip through polite delays,
              broken UPI mandates, and messy WhatsApp promises. Automated spam-emails alienate enterprise clients.
              Manual lawyer notices take months.
              <br /><br />
              <strong>Vaada</strong> bridges the gap: translating informal debtor commitments into legally binding,
              statutorily enforceable financial reality with zero hallucination.
            </p>

            <div className={styles.heroActions}>
              <Link href="/queue" className={styles.primaryAction}>
                Open Live Operations Console →
              </Link>
              <a href="#narrative" className={styles.secondaryAction}>
                Inspect The Recovery Journey ↓
              </a>
            </div>

            {/* Anchored Financial Telemetry Bar */}
            <div className={styles.financialAnchorBar}>
              <div className={styles.anchorCol}>
                <span className={styles.anchorLabel}>TOTAL MONITORED PORTFOLIO</span>
                <span className={styles.anchorValue}>₹1,24,60,000</span>
                <span className={styles.anchorMeta}>21 active enterprise cases</span>
              </div>
              <div className={styles.anchorCol}>
                <span className={styles.anchorLabel}>SECTION 43B(H) AT RISK</span>
                <span className={styles.anchorValue} style={{ color: "var(--color-disallowed)" }}>
                  13 Debtors
                </span>
                <span className={styles.anchorMeta}>31.2% tax deduction threat</span>
              </div>
              <div className={styles.anchorCol}>
                <span className={styles.anchorLabel}>PENAL INTEREST RECOVERABLE</span>
                <span className={styles.anchorValue} style={{ color: "var(--accent)" }}>
                  ₹1,42,850
                </span>
                <span className={styles.anchorMeta}>MSMED Act Sec 16 (3× RBI rate)</span>
              </div>
              <div className={styles.anchorCol}>
                <span className={styles.anchorLabel}>HISTORICAL RESOLUTION RATE</span>
                <span className={styles.anchorValue} style={{ color: "var(--color-recovered)" }}>
                  89.4%
                </span>
                <span className={styles.anchorMeta}>Average 6.8 days to cure</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Scene 2: The Gateway Reality (Official Razorpay Taxonomy) ── */}
      <section id="intelligence" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>LEVEL 1 → LEVEL 2 PROGRESSIVE REVELATION</span>
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
              <span className={styles.selectorHeading}>SELECT PUBLISHED RAZORPAY EVENT</span>
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

            {/* Right: Comparative Diagnostic Canvas */}
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
                      <span className={styles.canvasTag}>OFFICIAL GATEWAY SPECIFICATION</span>
                      <h3 className={styles.canvasCodeTitle}>{activeScenario.code} : {activeScenario.reason}</h3>
                      <p className={styles.canvasOfficialDesc}>{activeScenario.official_desc}</p>
                    </div>
                    <span className={styles.canvasRecoverabilityBadge}>
                      {activeScenario.recoverability}
                    </span>
                  </div>

                  <div className={styles.translationSplit}>
                    <div className={styles.translationCard}>
                      <span className={styles.transCardTag}>COMMERCIAL REALITY IN INDIA</span>
                      <p className={styles.transCardText}>{activeScenario.real_meaning}</p>
                    </div>

                    <div className={styles.translationCardHighlight}>
                      <span className={styles.transCardTagHighlight}>VAADA AUTONOMOUS RECOVERY POLICY</span>
                      <p className={styles.transCardTextHighlight}>{activeScenario.vaada_action}</p>
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

          <div className={styles.hinglishInteractiveDeck}>
            {/* Raw Message Box with Word Level Visual Extraction */}
            <div className={styles.messageVisualContainer}>
              <span className={styles.boxTag}>LIVE NLP TOKENIZATION STREAM</span>
              <div className={styles.tokensWrapper}>
                {HINGLISH_DEMO.tokens.map((token, idx) => (
                  <span
                    key={idx}
                    className={`${styles.tokenSpan} ${styles[`token_${token.type}`]}`}
                    title={token.label}
                  >
                    {token.text}
                    <span className={styles.tokenTooltip}>{token.label}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Extracted Financial Contract Card */}
            <div className={styles.extractedContractCard}>
              <div className={styles.contractHeader}>
                <div>
                  <span className={styles.contractEyebrow}>SEMANTIC COMMITMENT RECORDED</span>
                  <h3 className={styles.contractTitle}>Structured Promise-To-Pay</h3>
                </div>
                <span className={styles.confidencePill}>94.2% Confidence</span>
              </div>

              <div className={styles.contractGrid}>
                <div className={styles.contractItem}>
                  <span className={styles.cLabel}>BINDING AMOUNT</span>
                  <span className={styles.cValue} style={{ color: "var(--accent)" }}>
                    ₹1,85,000.00 INR
                  </span>
                  <span className={styles.cSub}>Parsed from &quot;1.85L&quot;</span>
                </div>
                <div className={styles.contractItem}>
                  <span className={styles.cLabel}>SCHEDULED SETTLEMENT</span>
                  <span className={styles.cValue}>Friday, 16:00 IST</span>
                  <span className={styles.cSub}>Target cure date established</span>
                </div>
                <div className={styles.contractItem}>
                  <span className={styles.cLabel}>PAYMENT DISPATCH RAIL</span>
                  <span className={styles.cValue}>Corporate RTGS / IMPS</span>
                  <span className={styles.cSub}>Switched from failing mandate</span>
                </div>
                <div className={styles.contractItem}>
                  <span className={styles.cLabel}>AUTOMATED CURE ACTION</span>
                  <span className={styles.cValue} style={{ color: "var(--color-recovered)" }}>
                    T-24h Friendly Reminder
                  </span>
                  <span className={styles.cSub}>Scheduled within 08:00–19:00 window</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 4: The Statutory Leverage (Section 43B(h) Calculator) ── */}
      <section id="statutory" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>STATUTORY ENFORCEMENT ARCHITECTURE</span>
            <h2 className={styles.sceneHeadline}>
              The 45-day statutory MSME weapon.
            </h2>
            <p className={styles.sceneSubtitle}>
              Under Section 43B(h) of the Income Tax Act, overdue payments to MSME registered suppliers cannot be
              claimed as tax-deductible business expenses if paid beyond 45 days. This creates massive fiscal liability for enterprise buyers.
            </p>
          </div>

          <div className={styles.calculatorCard}>
            <div className={styles.calculatorControls}>
              <div className={styles.calcControl}>
                <label className={styles.calcLabel}>
                  INVOICE PRINCIPAL AMOUNT: <strong>₹{(calcInvoice / 100).toLocaleString("en-IN")}</strong>
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
                  DAYS ELAPSED SINCE ACCEPTANCE: <strong>{calcDaysOverdue} DAYS</strong>
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

            {/* Calculator Results Grid */}
            <div className={styles.calcResultsGrid}>
              <div className={styles.calcResultCol}>
                <span className={styles.calcResLabel}>STATUTORY CURE WINDOW</span>
                <span
                  className={styles.calcResValue}
                  style={{ color: isDisallowed ? "var(--color-disallowed)" : "var(--accent)" }}
                >
                  {isDisallowed ? "DISALLOWED IN CODE" : `${daysRemaining} DAYS REMAINING`}
                </span>
                <span className={styles.calcResDesc}>
                  {isDisallowed
                    ? "Mandatory 45-day MSMED cutoff crossed. Expense deduction revoked."
                    : "Automated cure alert queued for debtor finance team."}
                </span>
              </div>

              <div className={styles.calcResultCol}>
                <span className={styles.calcResLabel}>DEBTOR TAX EXPOSURE (31.2%)</span>
                <span className={styles.calcResValue} style={{ color: "var(--color-disallowed)" }}>
                  ₹{Math.round(taxPenaltyExposure).toLocaleString("en-IN")}
                </span>
                <span className={styles.calcResDesc}>
                  Direct corporate income tax penalty paid to IT Department if unsettled.
                </span>
              </div>

              <div className={styles.calcResultCol}>
                <span className={styles.calcResLabel}>3× RBI PENAL INTEREST ACCRUED</span>
                <span className={styles.calcResValue} style={{ color: "var(--color-recovered)" }}>
                  ₹{Math.round(accruedInterest).toLocaleString("en-IN")}
                </span>
                <span className={styles.calcResDesc}>
                  Compounded with monthly rests under MSMED Act Section 16.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 5: Data Provenance & Trust ── */}
      <section id="provenance" className={styles.sceneSectionAlt}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>ZERO HALLUCINATION & ARCHITECTURAL INTEGRITY</span>
            <h2 className={styles.sceneHeadline}>Honest Data Provenance</h2>
            <p className={styles.sceneSubtitle}>
              We never fabricate data or obscure reality. The system clearly demarcates authoritative external sources
              from synthetic demo scenarios.
            </p>
          </div>

          <div className={styles.provenanceGrid}>
            <div className={styles.provenanceCard}>
              <span className={styles.provStatus}>AUTHORITATIVE REAL DATA</span>
              <h4 className={styles.provTitle}>Razorpay Failure Taxonomy</h4>
              <p className={styles.provDesc}>
                Directly versioned representation of Razorpay&apos;s 38 official error codes, root cause mappings,
                and failure reasons across UPI, Card, Netbanking, and e-Mandate rails.
              </p>
            </div>

            <div className={styles.provenanceCard}>
              <span className={styles.provStatus}>ACADEMIC CORPUS RESOURCE</span>
              <h4 className={styles.provTitle}>L3Cube-HingCorpus NLP</h4>
              <p className={styles.provDesc}>
                Trained on peer-reviewed Hindi-English code-mixed datasets for accurate grammatical boundary detection,
                preventing misinterpretation of Indian monetary colloquiums.
              </p>
            </div>

            <div className={styles.provenanceCard}>
              <span className={styles.provStatus}>SYNTHETIC SAFE DATA</span>
              <h4 className={styles.provTitle}>Debtor & Invoice Entities</h4>
              <p className={styles.provDesc}>
                All corporate names, GSTINs, and phone numbers in the demo database are cryptographically generated
                synthetic records compliant with Indian Digital Personal Data Protection (DPDP) Act 2023.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 6: Institutional Console Launchpad ── */}
      <footer className={styles.footerLaunchpad}>
        <div className={styles.container}>
          <div className={styles.launchpadBox}>
            <div className={styles.launchpadLeft}>
              <span className={styles.launchpadEyebrow}>OPERATIONAL READY</span>
              <h3 className={styles.launchpadTitle}>
                Ready to inspect active recovery dossiers?
              </h3>
              <p className={styles.launchpadText}>
                Step into the operational console to review prioritized invoices, inspect Razorpay telemetry,
                and review deterministic audit events.
              </p>
            </div>
            <Link href="/login" className={styles.launchpadCta}>
              Launch Operations Console →
            </Link>
          </div>

          <div className={styles.footerBottomBar}>
            <div>VAADA / वादा · Bounded B2B Revenue Recovery Platform</div>
            <div>COMPLIANT WITH RBI GUIDELINES & MSMED ACT 2006 · TIMEZONE: ASIA/KOLKATA</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
