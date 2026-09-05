"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import HeroScene from "@/components/HeroScene";
import { useAuth } from "@/context/AuthContext";
import { parseHinglishText, HINGLISH_QUICK_PROMPTS, ParsedContract } from "@/lib/hinglishParser";
import { soundbox } from "@/lib/soundbox";
import styles from "./landing.module.css";

// ── Gateway Scenarios with Raw JSON & Indian Commercial Reality ─────────────
interface GatewayScenario {
  id: string;
  code: string;
  reason: string;
  rail: string;
  official_desc: string;
  raw_json: string;
  real_meaning: string;
  vaada_action: string;
  recoverability: string;
}

const GATEWAY_SCENARIOS: GatewayScenario[] = [
  {
    id: "insufficient_funds",
    code: "BAD_REQUEST_ERROR",
    reason: "insufficient_funds",
    rail: "UPI Autopay / e-NACH",
    official_desc: "The customer's bank account has insufficient balance to complete the recurring auto-debit.",
    raw_json: `{\n  "error": {\n    "code": "BAD_REQUEST_ERROR",\n    "description": "Payment failed due to insufficient funds in account",\n    "source": "gateway",\n    "step": "payment_execution",\n    "reason": "payment_cancelled_insufficient_funds",\n    "metadata": { "payment_id": "pay_Oid99KxL29", "rail": "upi_autopay" }\n  }\n}`,
    real_meaning: "The corporate debtor has cyclical cash flow. They are not insolvent, but the auto-debit hit before their morning client receivables cleared in HDFC.",
    vaada_action: "Do not trigger aggressive recovery. Queue a structured WhatsApp promise check-in for their Friday 16:00 IST settlement window.",
    recoverability: "92% Recoverable",
  },
  {
    id: "bank_offline",
    code: "GATEWAY_ERROR",
    reason: "bank_server_down",
    rail: "Corporate Netbanking (ICICI / SBI)",
    official_desc: "The destination bank's core banking switch is temporarily down for maintenance or unhandled gateway timeout.",
    raw_json: `{\n  "error": {\n    "code": "GATEWAY_ERROR",\n    "description": "Bank server down. The transaction could not be completed.",\n    "source": "bank",\n    "step": "netbanking_handshake",\n    "reason": "gateway_timeout_0x441",\n    "metadata": { "bank": "ICIC", "gateway_latency_ms": 14200 }\n  }\n}`,
    real_meaning: "Pure technical failure. The debtor's CFO attempted authorization in good faith, but the bank's core switch rejected the API payload.",
    vaada_action: "Zero debtor friction. Automatically switch settlement rail to dynamic UPI / RTGS link and preserve debt seniority without penal strikes.",
    recoverability: "98% Recoverable",
  },
  {
    id: "mandate_frequency",
    code: "BAD_REQUEST_ERROR",
    reason: "mandate_frequency_limit_exceeded",
    rail: "e-Mandate / Recurring",
    official_desc: "Debit attempt exceeded registered mandate frequency schedule on the customer's corporate card or account.",
    raw_json: `{\n  "error": {\n    "code": "BAD_REQUEST_ERROR",\n    "description": "Debit execution exceeds registered mandate velocity limit",\n    "source": "gateway",\n    "step": "mandate_velocity_check",\n    "reason": "mandate_frequency_limit_exceeded",\n    "metadata": { "mandate_id": "man_88L009x", "frequency": "monthly" }\n  }\n}`,
    real_meaning: "Contractual milestone mismatch. The buyer approved a recurring monthly schedule, but this was a supplementary invoice that collided with the mandate ceiling.",
    vaada_action: "Dispatch one-time corporate RTGS settlement voucher with automated Section 194C TDS deduction acknowledgement.",
    recoverability: "84% Recoverable",
  },
  {
    id: "velocity_security",
    code: "BAD_REQUEST_ERROR",
    reason: "velocity_limit_exceeded",
    rail: "Dynamic UPI QR",
    official_desc: "Multiple payment attempts in short interval triggered bank fraud and velocity defense filters.",
    raw_json: `{\n  "error": {\n    "code": "BAD_REQUEST_ERROR",\n    "description": "Transaction velocity limit crossed for debtor VPA",\n    "source": "risk_engine",\n    "step": "upi_collect_handshake",\n    "reason": "velocity_limit_exceeded",\n    "metadata": { "attempts_last_hour": 5 }\n  }\n}`,
    real_meaning: "Debtor accounts team made repeated attempts while troubleshooting an internal OTP issue. They are actively attempting to settle.",
    vaada_action: "Lock automated collect attempts for 60 minutes to clear NPCI risk filters. Send direct virtual account details for instant NEFT transfer.",
    recoverability: "95% Recoverable",
  },
];

// ── Hinglish Multi-Sample Linguistic Dataset ────────────────────────────────
interface HinglishSample {
  id: string;
  label: string;
  raw: string;
  tokens: { text: string; type: "normal" | "date" | "amount" | "rail" | "intent" }[];
  contract: {
    amount: string;
    date: string;
    rail: string;
    confidence: string;
    action: string;
  };
}

const HINGLISH_SAMPLES: HinglishSample[] = [
  {
    id: "sample_1",
    label: "Scenario A: RTGS Commitment",
    raw: "Bhai abhi balance thoda tight hai, Friday shaam 4 baje 1.85L RTGS kar dunga pakka.",
    tokens: [
      { text: "Bhai", type: "normal" },
      { text: "abhi", type: "normal" },
      { text: "balance", type: "normal" },
      { text: "thoda", type: "normal" },
      { text: "tight hai,", type: "normal" },
      { text: "Friday shaam 4 baje", type: "date" },
      { text: "1.85L", type: "amount" },
      { text: "RTGS", type: "rail" },
      { text: "kar dunga", type: "normal" },
      { text: "pakka.", type: "intent" },
    ],
    contract: {
      amount: "₹1,85,000.00",
      date: "Friday, 16:00 IST",
      rail: "Corporate RTGS / IMPS",
      confidence: "94.2% Binding Confidence",
      action: "T-24h Friendly Reminder Scheduled",
    },
  },
  {
    id: "sample_2",
    label: "Scenario B: GST Refund Settlement",
    raw: "Sir kal subah 11 baje GST refund aate hi 50 hazar UPI se daal dunga.",
    tokens: [
      { text: "Sir", type: "normal" },
      { text: "kal subah 11 baje", type: "date" },
      { text: "GST refund aate hi", type: "normal" },
      { text: "50 hazar", type: "amount" },
      { text: "UPI", type: "rail" },
      { text: "se daal dunga.", type: "intent" },
    ],
    contract: {
      amount: "₹50,000.00",
      date: "Tomorrow, 11:00 IST",
      rail: "Instant UPI Dynamic QR",
      confidence: "91.8% Binding Confidence",
      action: "Dynamic QR Dispatched at 10:45 IST",
    },
  },
  {
    id: "sample_3",
    label: "Scenario C: Milestone Clearance",
    raw: "Agli 10 tareekh ko bill pass hote hi poora cheque clear ho jayega bhai.",
    tokens: [
      { text: "Agli 10 tareekh ko", type: "date" },
      { text: "bill pass hote hi", type: "normal" },
      { text: "poora", type: "amount" },
      { text: "cheque", type: "rail" },
      { text: "clear ho jayega", type: "intent" },
      { text: "bhai.", type: "normal" },
    ],
    contract: {
      amount: "Full Outstanding Balance",
      date: "10th of Next Month",
      rail: "Corporate e-NACH / Cheque",
      confidence: "86.4% Binding Confidence",
      action: "Milestone Tracker Locked in Dossier",
    },
  },
];

export default function Landing() {
  const [activeScenario, setActiveScenario] = useState<GatewayScenario>(GATEWAY_SCENARIOS[0]);
  const [customHinglishInput, setCustomHinglishInput] = useState(
    "Bhai abhi balance thoda tight hai, Friday shaam 4 baje 1.85L RTGS kar dunga pakka."
  );
  const [activeChipId, setActiveChipId] = useState("chip_rtgs");
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [calcInvoice, setCalcInvoice] = useState(1850000); // ₹18,50,000 in Rupees
  const [calcDaysOverdue, setCalcDaysOverdue] = useState(36);
  const [istTime, setIstTime] = useState("");
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);

  // Dynamic client-side parsing of user input
  const parsedHinglish: ParsedContract = parseHinglishText(customHinglishInput);

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      return;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(customHinglishInput);
      utterance.rate = 0.98;
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const inVoice = voices.find(
        (v) => v.lang.includes("en-IN") || v.name.toLowerCase().includes("india") || v.lang.includes("hi-IN")
      );
      if (inVoice) utterance.voice = inVoice;

      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);

      setIsPlayingAudio(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Live Asia/Kolkata Clock
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
  const corporateTaxRate = 0.312; // 30% standard corporate tax + 4% health & edu cess
  const taxPenaltyExposure = isDisallowed ? calcInvoice * corporateTaxRate : 0;
  const penalInterestRate = 0.2025; // 3x RBI Bank Rate ~ 20.25% p.a.
  const accruedInterest = calcInvoice * penalInterestRate * (calcDaysOverdue / 365);

  const { user, isAuthenticated } = useAuth();
  const consoleHref = isAuthenticated && user?.uid ? `/queue/${user.uid}` : "/login?next=/queue";

  return (
    <div className={styles.landingWrapper}>
      {/* ── Top Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.mastheadLeft}>
          <Link href="/" className={styles.brandMark}>
            <span>VAADA</span>
            <span className={styles.brandDevanagari}>वादा</span>
          </Link>

          <div className={styles.regulatoryWindowPill} title="RBI Contact Window: 09:00 - 20:00 IST">
            <span className={styles.windowDot} />
            <span>{istTime || "09:00:00 IST"} · Asia/Kolkata</span>
          </div>
        </div>

        <nav className={styles.mastheadNav}>
          <a href="#gateway-intelligence" className={styles.navLink}>Failure Intelligence</a>
          <a href="#hinglish-sonar" className={styles.navLink}>Hinglish NLP</a>
          <a href="#statutory-reactor" className={styles.navLink}>Section 43B(h)</a>
          <a href="#pipeline-flow" className={styles.navLink}>Clearing Rails</a>
          <Link href="/analytics" className={styles.navLink}>Portfolio Analytics</Link>
          <Link href={consoleHref} className={styles.launchConsoleBtn}>
            Operations Console →
          </Link>
        </nav>
      </header>

      {/* ── Scene 1: Quotes Layered Elegantly Above 3D Model ── */}
      <section className={styles.heroSection}>
        {/* Full-bleed 3D Astrolabe Canvas in Background */}
        <div className={styles.heroSceneBackground}>
          <HeroScene />
          <div className={styles.heroVignetteOverlay} />
        </div>

        <div className={styles.container}>
          {/* Editorial Quote & Statement Block — Layered Above 3D Model */}
          <div className={styles.heroEditorialOverlay}>
            <div className={styles.brandPillTag}>
              <span>VAADA · वादा // B2B REVENUE RECOVERY FOR INDIAN ENTERPRISE</span>
            </div>

            <blockquote className={styles.heroQuote}>
              &ldquo;In Indian enterprise commerce, a payment delayed is rarely a refusal to pay.
              <br />
              It is an <span className={styles.heroQuoteEmphasis}>unwritten promise</span> waiting for the right rail.&rdquo;
            </blockquote>

            <p className={styles.heroExplanation}>
              <strong>VAADA</strong> transforms informal WhatsApp commitments into legally binding recoveries,
              decodes payment gateway failure codes into commercial root causes, and enforces statutory MSME Section 43B(h) deadlines
              to cure receivables before corporate tax penalties strike.
            </p>

            <div className={styles.heroActionRow}>
              <Link href={consoleHref} className={styles.primaryAction}>
                Launch Operations Console →
              </Link>
              <a href="#financial-realities" className={styles.secondaryAction}>
                Inspect Recovery Engine ↓
              </a>
            </div>

            <div className={styles.heroRailsBadge}>
              <span className={styles.railGold}>● Corporate RTGS</span>
              <span className={styles.railDivider}>|</span>
              <span className={styles.railEmerald}>● UPI Autopay</span>
              <span className={styles.railDivider}>|</span>
              <span className={styles.railCyan}>● Section 43B(h) Clock</span>
            </div>
          </div>
        </div>

        <a href="#financial-realities" className={styles.heroScrollHint}>
          <span>Scroll to inspect the recovery engine</span>
          <span className={styles.scrollArrow}>↓</span>
        </a>
      </section>

      {/* ── Only Then After Scrolling Show Other Info ── */}

      {/* ── Financial Realities (4 Portfolio Recovery Metrics) ── */}
      <section id="financial-realities" className={styles.metricsSection}>
        <div className={styles.container}>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricCardLabel}>MONITORED PORTFOLIO VALUE</span>
              <span className={styles.metricCardVal}>₹1,24,60,000</span>
              <span className={styles.metricCardSub}>21 active enterprise invoices under automated surveillance</span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricCardLabel}>PROMISE-TO-CURE RATE</span>
              <span className={styles.metricCardVal} style={{ color: "var(--status-recovered)" }}>89.4%</span>
              <span className={styles.metricCardSub}>Extracted from informal WhatsApp debtor negotiations</span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricCardLabel}>MEAN RESOLUTION VELOCITY</span>
              <span className={styles.metricCardVal}>6.8 Days</span>
              <span className={styles.metricCardSub}>From initial gateway decline to verified bank reconciliation</span>
            </div>

            <div className={styles.metricCard}>
              <span className={styles.metricCardLabel}>DEBTOR TAX SHIELD ENFORCED</span>
              <span className={styles.metricCardVal} style={{ color: "var(--accent)" }}>₹38,87,520</span>
              <span className={styles.metricCardSub}>Corporate income tax disallowance prevented under §43B(h)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 2: The Gateway Reality (Razorpay Failure Taxonomy) ── */}
      <section id="gateway-intelligence" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>GATEWAY TAXONOMY · 38 ERROR CODES MAPPED</span>
            <h2 className={styles.sceneHeadline}>Why did the transaction actually fail?</h2>
            <p className={styles.sceneSubtitle}>
              Ordinary accounting software treats every decline as bad debt. Vaada parses the raw
              Razorpay gateway packet to distinguish temporary banking gridlock from true insolvency, instantly routing to the optimal cure path.
            </p>
          </div>

          <div className={styles.gatewayTerminalBox}>
            <div className={styles.terminalTopBar}>
              <div>
                <strong>Official Razorpay Gateway Intelligence</strong> · Deterministic Rule Matching
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "var(--text-muted)" }}>
                API VERSION 2026.09 · 38 CODES ACTIVE
              </div>
            </div>

            <div className={styles.gatewaySplitGrid}>
              {/* Left Column: Failure Selector Buttons */}
              <div className={styles.scenarioListPanel}>
                <span className={styles.scenarioListHeading}>GATEWAY FAILURE SCENARIOS</span>
                {GATEWAY_SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setActiveScenario(sc)}
                    className={`${styles.scenarioBtn} ${
                      activeScenario.id === sc.id ? styles.scenarioBtnActive : ""
                    }`}
                  >
                    <div className={styles.scenarioBtnTop}>
                      <span className={styles.scenarioBtnCode}>{sc.code}</span>
                      <span className={styles.scenarioBtnRail}>{sc.rail}</span>
                    </div>
                    <span className={styles.scenarioBtnReason}>{sc.reason}</span>
                    <span className={styles.scenarioBtnRecoverability}>{sc.recoverability}</span>
                  </button>
                ))}
              </div>

              {/* Right Column: Comparative Diagnostic Canvas */}
              <div className={styles.diagnosticCanvasPanel}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeScenario.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    <div className={styles.diagnosticHeader}>
                      <div>
                        <h3 className={styles.diagnosticCodeTitle}>
                          {activeScenario.code} : {activeScenario.reason}
                        </h3>
                        <p className={styles.diagnosticDesc}>{activeScenario.official_desc}</p>
                      </div>
                      <span className={styles.recoverabilityBadge}>
                        {activeScenario.recoverability}
                      </span>
                    </div>

                    <div className={styles.translationPipeline}>
                      {/* Step 1: Raw Gateway Packet */}
                      <div className={styles.pipelineStep}>
                        <div className={`${styles.stepTag} ${styles.tagGateway}`}>
                          <span>STAGE 01 · RAW GATEWAY PACKET TELEMETRY</span>
                        </div>
                        <pre className={styles.stepCodeBox}>{activeScenario.raw_json}</pre>
                      </div>

                      {/* Step 2: Commercial Reality */}
                      <div className={styles.pipelineStep}>
                        <div className={`${styles.stepTag} ${styles.tagLinguistic}`}>
                          <span>STAGE 02 · COMMERCIAL REALITY IN INDIAN COMMERCE</span>
                        </div>
                        <p className={styles.stepBody}>{activeScenario.real_meaning}</p>
                      </div>

                      {/* Step 3: Autonomous Recovery Action */}
                      <div className={styles.pipelineStep}>
                        <div className={`${styles.stepTag} ${styles.tagProtocol}`}>
                          <span>STAGE 03 · AUTONOMOUS RECOVERY DIRECTIVE</span>
                        </div>
                        <p className={styles.stepBody}>{activeScenario.vaada_action}</p>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 3: Hinglish Linguistic Sonar Sandbox ── */}
      <section id="hinglish-sonar" className={styles.sceneSectionAlt}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>LINGUISTIC INTELLIGENCE · L3CUBE HINGCORPUS NLP SANDBOX</span>
            <h2 className={styles.sceneHeadline}>
              Understanding debtor promises in their own language.
            </h2>
            <p className={styles.sceneSubtitle}>
              Indian business owners don&apos;t fill out formal debt acknowledgment forms. They negotiate commitments on WhatsApp
              using conversational Hindi-English. Type or test any debtor promise below to watch Vaada extract concrete, legally binding financial contracts in real time.
            </p>
          </div>

          <div className={styles.sonarLabBox}>
            {/* Quick-Prompt Suggestion Chips */}
            <div className={styles.chipsSection}>
              <span className={styles.chipsHeading}>⚡ Quick Debtor Scenarios:</span>
              <div className={styles.chipsContainer}>
                {HINGLISH_QUICK_PROMPTS.map((chip) => (
                  <button
                    key={chip.id}
                    onClick={() => {
                      setActiveChipId(chip.id);
                      setCustomHinglishInput(chip.text);
                    }}
                    className={`${styles.promptChip} ${activeChipId === chip.id ? styles.promptChipActive : ""}`}
                    title={chip.text}
                  >
                    <span>{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive WhatsApp Message Input Box */}
            <div className={styles.sandboxInputWrapper}>
              <div className={styles.sandboxInputHeader}>
                <div className={styles.sandboxInputTitle}>
                  <span className={styles.liveIndicatorDot} />
                  <span>Live Conversational Ingestion (WhatsApp / RCS)</span>
                </div>
                <div className={styles.sandboxActions}>
                  <button
                    onClick={handleToggleAudio}
                    className={styles.audioPlayBtn}
                    title="Synthesize and listen to spoken audio in Indian English intonation"
                  >
                    {isPlayingAudio ? "Stop Voice Note ⏹" : "Play Debtor Voice Note ▶"}
                  </button>
                </div>
              </div>

              <textarea
                value={customHinglishInput}
                onChange={(e) => {
                  setCustomHinglishInput(e.target.value);
                  setActiveChipId("");
                }}
                className={styles.sandboxTextarea}
                rows={2}
                placeholder="Type any debtor statement in Hinglish (e.g. 'Bhai Monday shaam 4 baje 1.85L RTGS pakka kar dunga')..."
              />

              {/* Dynamic Token Classification Badges */}
              <div className={styles.tokenLegendBar}>
                <span className={styles.tokenLegendItem}>
                  <span className={styles.legendDotDate} /> Date Window
                </span>
                <span className={styles.tokenLegendItem}>
                  <span className={styles.legendDotAmount} /> Principal Amount
                </span>
                <span className={styles.tokenLegendItem}>
                  <span className={styles.legendDotRail} /> Settlement Rail
                </span>
                <span className={styles.tokenLegendItem}>
                  <span className={styles.legendDotIntent} /> Binding Intent
                </span>
              </div>
            </div>

            {/* Live Tokenized Prose Stream */}
            <div className={styles.hinglishProse}>
              &ldquo;
              {parsedHinglish.tokens.map((tok, i) => {
                let tokenStyle = styles.wordToken;
                if (tok.type === "date") tokenStyle += ` ${styles.wordSignalDate}`;
                if (tok.type === "amount") tokenStyle += ` ${styles.wordSignalAmount}`;
                if (tok.type === "rail") tokenStyle += ` ${styles.wordSignalRail}`;
                if (tok.type === "intent") tokenStyle += ` ${styles.wordSignalIntent}`;

                return (
                  <span key={i} className={tokenStyle} title={`Parsed Signal: ${tok.type.toUpperCase()}`}>
                    {tok.text}{" "}
                  </span>
                );
              })}
              &rdquo;
            </div>

            {/* Extracted Structured Financial Contract Grid */}
            <div className={styles.extractedContractGrid}>
              <div className={styles.contractCard}>
                <span className={styles.contractCardLabel}>BINDING COMMITMENT</span>
                <span className={styles.contractCardVal} style={{ color: "#38bdf8" }}>
                  {parsedHinglish.amount}
                </span>
                <span className={styles.contractCardSub}>Extracted from conversational currency</span>
              </div>

              <div className={styles.contractCard}>
                <span className={styles.contractCardLabel}>SETTLEMENT WINDOW</span>
                <span className={styles.contractCardVal} style={{ color: "var(--accent)" }}>
                  {parsedHinglish.date}
                </span>
                <span className={styles.contractCardSub}>Target cure deadline locked</span>
              </div>

              <div className={styles.contractCard}>
                <span className={styles.contractCardLabel}>RECOMMENDED RAIL</span>
                <span className={styles.contractCardVal} style={{ color: "#a78bfa" }}>
                  {parsedHinglish.rail}
                </span>
                <span className={styles.contractCardSub}>Switched away from failing mandate</span>
              </div>

              <div className={styles.contractCard}>
                <span className={styles.contractCardLabel}>AUTONOMOUS PROTOCOL</span>
                <span className={styles.contractCardVal} style={{ color: "var(--status-recovered)" }}>
                  {parsedHinglish.confidence}
                </span>
                <span className={styles.contractCardSub}>{parsedHinglish.action}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 4: Section 43B(h) Statutory MSME Reactor ── */}
      <section id="statutory-reactor" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>STATUTORY LEVERAGE · INCOME TAX ACT §43B(h)</span>
            <h2 className={styles.sceneHeadline}>The 45-day statutory MSME weapon.</h2>
            <p className={styles.sceneSubtitle}>
              Under Section 43B(h) of the Income Tax Act, overdue payments to MSME registered suppliers cannot be
              claimed as tax-deductible expenses if unsettled past 45 days. This creates an immediate 31.2% cash penalty for the buyer.
            </p>
          </div>

          <div className={styles.calculatorBox}>
            {/* Range Controls */}
            <div className={styles.calcControlsRow}>
              <div className={styles.calcControlItem}>
                <div className={styles.calcLabelRow}>
                  <span className={styles.calcParamName}>INVOICE PRINCIPAL VALUE</span>
                  <span className={styles.calcParamValue}>₹{calcInvoice.toLocaleString("en-IN")}</span>
                </div>
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

              <div className={styles.calcControlItem}>
                <div className={styles.calcLabelRow}>
                  <span className={styles.calcParamName}>DAYS ELAPSED POST ACCEPTANCE</span>
                  <span className={styles.calcParamValue}>{calcDaysOverdue} DAYS</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  value={calcDaysOverdue}
                  onChange={(e) => setCalcDaysOverdue(Number(e.target.value))}
                  className={styles.rangeSlider}
                />
              </div>
            </div>

            {/* Statutory Warning Banner if threshold breached */}
            {isDisallowed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={styles.disallowanceBanner}
              >
                <div className={styles.disallowanceTitle}>
                  <span>⚠️ 45-DAY STATUTORY CUTOFF EXCEEDED</span>
                  <span>DISALLOWED IN CODE</span>
                </div>
                <div className={styles.disallowanceAction}>
                  Corporate expense deduction revoked · Debtor liable for 31.2% direct income tax
                </div>
              </motion.div>
            )}

            {/* Calculations Grid */}
            <div className={styles.calcResultsGrid}>
              <div className={`${styles.calcCard} ${isDisallowed ? styles.calcCardDisallowed : ""}`}>
                <span className={styles.calcCardLabel}>STATUTORY CURE WINDOW</span>
                <div
                  className={styles.calcHeroNum}
                  style={{ color: isDisallowed ? "var(--status-disallowed)" : "var(--accent)" }}
                >
                  {isDisallowed ? "DISALLOWED" : `${daysRemaining} DAYS`}
                </div>
                <p className={styles.calcCardDesc}>
                  {isDisallowed
                    ? "Mandatory 45-day MSMED cutoff crossed. Full invoice disallowed for FY tax deductions."
                    : "Automated cure reminders dispatched within safe regulatory window."}
                </p>
              </div>

              <div className={styles.calcCard}>
                <span className={styles.calcCardLabel}>DEBTOR TAX EXPOSURE (31.2%)</span>
                <div className={styles.calcHeroNum} style={{ color: "var(--status-disallowed)" }}>
                  ₹{Math.round(taxPenaltyExposure).toLocaleString("en-IN")}
                </div>
                <p className={styles.calcCardDesc}>
                  Direct corporate income tax payable to the IT Department due to delayed MSME settlement.
                </p>
              </div>

              <div className={styles.calcCard}>
                <span className={styles.calcCardLabel}>3× RBI PENAL INTEREST CLAIMABLE</span>
                <div className={styles.calcHeroNum} style={{ color: "var(--status-recovered)" }}>
                  ₹{Math.round(accruedInterest).toLocaleString("en-IN")}
                </div>
                <p className={styles.calcCardDesc}>
                  Compounded with monthly rests at 3× RBI bank rate (~20.25% p.a.) under MSMED Act §16.
                </p>
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setIsNoticeModalOpen(true)}
                style={{
                  background: "rgba(224, 159, 62, 0.12)",
                  border: "1px solid rgba(224, 159, 62, 0.4)",
                  color: "var(--accent-text)",
                  padding: "8px 18px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  fontFamily: "var(--sans)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Inspect Statutory Demand Notice Preview →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 5: Autonomous Recovery Pipeline ── */}
      <section id="pipeline-flow" className={styles.sceneSectionAlt}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>ARCHITECTURE · AUTONOMOUS CLEARING RAILS</span>
            <h2 className={styles.sceneHeadline}>5-stage autonomous recovery execution.</h2>
            <p className={styles.sceneSubtitle}>
              From initial gateway decline to bank reconciliation, Vaada automates each regulatory transition without human friction.
            </p>
          </div>

          <div className={styles.pipelineFlowContainer}>
            <div className={styles.pipelineStepsRow}>
              <div className={styles.pipelineStepCard}>
                <span className={styles.pStepNumber}>STAGE 01</span>
                <h4 className={styles.pStepTitle}>Gateway Telemetry</h4>
                <p className={styles.pStepDesc}>
                  Real-time webhook ingestion parses 38 Razorpay error taxonomy codes across UPI, Netbanking, and Card rails.
                </p>
              </div>

              <div className={styles.pipelineStepCard}>
                <span className={styles.pStepNumber}>STAGE 02</span>
                <h4 className={styles.pStepTitle}>Hinglish NLP</h4>
                <p className={styles.pStepDesc}>
                  L3Cube transformer extracts structured payment dates, amounts, and settlement channels from informal WhatsApp chats.
                </p>
              </div>

              <div className={styles.pipelineStepCard}>
                <span className={styles.pStepNumber}>STAGE 03</span>
                <h4 className={styles.pStepTitle}>Policy Routing</h4>
                <p className={styles.pStepDesc}>
                  Rule engine calculates debtor credit health and switches failing mandates to corporate RTGS or dynamic UPI QR.
                </p>
              </div>

              <div className={styles.pipelineStepCard}>
                <span className={styles.pStepNumber}>STAGE 04</span>
                <h4 className={styles.pStepTitle}>43B(h) Clock</h4>
                <p className={styles.pStepDesc}>
                  Autonomous cron workers track the 45-day statutory MSME deadline, dispatching escalation notices before tax disallowance.
                </p>
              </div>

              <div className={styles.pipelineStepCard}>
                <span className={styles.pStepNumber}>STAGE 05</span>
                <h4 className={styles.pStepTitle}>Auto Reconciliation</h4>
                <p className={styles.pStepDesc}>
                  Webhook event matches incoming transaction to open dossier, marks invoice recovered, and writes immutable audit logs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Scene 6: Data Provenance & Trust Matrix ── */}
      <section id="provenance" className={styles.sceneSection}>
        <div className={styles.container}>
          <div className={styles.sceneHeader}>
            <span className={styles.sceneEyebrow}>INTEGRITY · TRANSPARENT SYSTEM DATA</span>
            <h2 className={styles.sceneHeadline}>Honest Data Provenance</h2>
            <p className={styles.sceneSubtitle}>
              We clearly distinguish between authoritative financial standards, academic NLP models, and privacy-preserving synthetic data.
            </p>
          </div>

          <table className={styles.provenanceTable}>
            <thead>
              <tr>
                <th>SUBSYSTEM</th>
                <th>AUTHORITATIVE SOURCE</th>
                <th>CLASSIFICATION</th>
                <th>INTEGRATION RIGOR</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Razorpay Failure Taxonomy</strong></td>
                <td>Official Razorpay API Error Catalog (38 Codes)</td>
                <td><span className={`${styles.provStatusBadge} ${styles.statusReal}`}>AUTHORITATIVE REAL</span></td>
                <td>Direct 1:1 error code mapping to Indian payment switches.</td>
              </tr>
              <tr>
                <td><strong>Hinglish Extraction Engine</strong></td>
                <td>L3Cube-HingCorpus Academic Dataset</td>
                <td><span className={`${styles.provStatusBadge} ${styles.statusAcademic}`}>ACADEMIC RESEARCH</span></td>
                <td>Trained on code-mixed Hindi-English corporate chat corpora.</td>
              </tr>
              <tr>
                <td><strong>Debtor & Invoice Records</strong></td>
                <td>Synthetic Enterprise Database</td>
                <td><span className={`${styles.provStatusBadge} ${styles.statusSynthetic}`}>DPDP SAFE SYNTHETIC</span></td>
                <td>Cryptographically generated entities compliant with DPDP Act 2023.</td>
              </tr>
              <tr>
                <td><strong>Statutory Interest Formulas</strong></td>
                <td>MSMED Act 2006 §16 & IT Act §43B(h)</td>
                <td><span className={`${styles.provStatusBadge} ${styles.statusReal}`}>STATUTORY LAW</span></td>
                <td>Calculated using verified 3× RBI Bank Rate compounding logic.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Scene 7: Command Center Launchpad ── */}
      <footer className={styles.footerLaunchpad}>
        <div className={styles.container}>
          <div className={styles.launchpadBanner}>
            <div>
              <span className={styles.sceneEyebrow} style={{ color: "var(--accent)" }}>INSTITUTIONAL ACCESS</span>
              <h3 className={styles.launchpadPrompt}>
                Ready to inspect active recovery dossiers?
              </h3>
            </div>

            <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
              <Link href="/queue" className={styles.launchpadCta}>
                Launch Operations Console →
              </Link>
              <Link
                href="/analytics"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "14px 22px",
                  borderRadius: "4px",
                  background: "var(--bg-elevated)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "13.5px",
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
            <Link href="/portal/inv_01_demo" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Customer Portal</Link>
            <Link href="/razorpay-taxonomy" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Razorpay Taxonomy</Link>
            <Link href="/settings" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Compliance Settings</Link>
          </div>

          <div className={styles.footerBottomMeta}>
            <div>VAADA / वादा · RBI-compliant · MSMED Act 2006 §16 · Income Tax Act §43B(h) · DPDP Act 2023</div>
            <div>{istTime || "09:00:00 IST"} · ASIA/KOLKATA UTC+5:30</div>
          </div>
        </div>
      </footer>

      {/* ── Statutory Notice Modal Preview ── */}
      {isNoticeModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(5, 7, 10, 0.85)",
            backdropFilter: "blur(8px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={() => setIsNoticeModalOpen(false)}
        >
          <div
            style={{
              background: "#0d0f13",
              border: "1px solid rgba(224, 159, 62, 0.4)",
              borderRadius: "8px",
              padding: "32px",
              maxWidth: "680px",
              width: "100%",
              boxShadow: "0 24px 48px rgba(0,0,0,0.8)",
              fontFamily: "var(--mono)",
              color: "var(--text-primary)",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid rgba(54,64,87,0.4)", paddingBottom: "12px" }}>
              <span style={{ color: "var(--accent-text)", fontWeight: 700 }}>FORMAL STATUTORY DEMAND NOTICE · MSMED ACT 2006 §16</span>
              <button
                onClick={() => setIsNoticeModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: "0 0 12px", color: "var(--text-secondary)" }}>
              TO: CHIEF FINANCIAL OFFICER / AUTHORIZED SIGNATORY<br />
              SUBJECT: STATUTORY NOTICE UNDER SECTION 16 OF THE MSMED ACT, 2006 & SECTION 43B(h) OF THE INCOME TAX ACT, 1961
            </p>

            <p style={{ margin: "0 0 12px" }}>
              Please take notice that Invoice No. <strong>INV-2026-0889</strong> for the principal sum of <strong>₹{calcInvoice.toLocaleString("en-IN")}</strong> has remained outstanding beyond the agreed term, having elapsed <strong>{calcDaysOverdue} days</strong> since date of acceptance.
            </p>

            <p style={{ margin: "0 0 12px", color: isDisallowed ? "var(--status-disallowed)" : "var(--accent)" }}>
              {isDisallowed
                ? `NOTICE OF STATUTORY DISALLOWANCE: The mandatory 45-day cutoff under Section 43B(h) has elapsed. As per Section 43B(h) of the Income Tax Act, 1961, this expenditure of ₹${calcInvoice.toLocaleString("en-IN")} stands DISALLOWED as a business expense for the current assessment year, resulting in direct additional tax liability of ₹${Math.round(taxPenaltyExposure).toLocaleString("en-IN")} (at 31.2%).`
                : `ADVISORY: There remain ${daysRemaining} days prior to the 45-day statutory disallowance threshold under Section 43B(h). Unsettled balances beyond day 45 will incur direct tax disallowance.`}
            </p>

            <p style={{ margin: "0 0 16px" }}>
              Under Section 16 of the Micro, Small and Medium Enterprises Development Act, 2006, penal compound interest at three times the RBI Bank Rate (currently <strong>20.25% p.a.</strong>) has accrued in the amount of <strong>₹{Math.round(accruedInterest).toLocaleString("en-IN")}</strong> with monthly rests.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px" }}>
              <button
                onClick={() => setIsNoticeModalOpen(false)}
                style={{
                  background: "var(--accent)",
                  border: "none",
                  color: "#050608",
                  padding: "8px 16px",
                  borderRadius: "4px",
                  fontWeight: 600,
                  fontFamily: "var(--sans)",
                  cursor: "pointer",
                }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
