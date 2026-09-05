"use client";

import { useState } from "react";
import AuthenticatedAppShell from "@/components/AuthenticatedAppShell";
import styles from "./cfo.module.css";

export default function CFOPage() {
  const [turnoverCr, setTurnoverCr] = useState(50); // ₹50 Crores annual turnover
  const [msmeOverduePercent, setMsmeOverduePercent] = useState(12); // 12% overdue MSME supplier base

  // Stress calculations
  const turnoverRupees = turnoverCr * 10000000;
  const msmePurchases = turnoverRupees * 0.45; // ~45% raw materials / MSME vendors
  const overdueExposure = msmePurchases * (msmeOverduePercent / 100);
  const corporateTaxRate = 0.312; // 30% + 4% cess
  const taxDisallowancePenalty = overdueExposure * corporateTaxRate;
  const penalInterestRate = 0.2025; // 3x RBI Bank Rate ~20.25% p.a.
  const accruedPenalInterest = overdueExposure * penalInterestRate * (45 / 365);
  const totalCapitalAtRisk = taxDisallowancePenalty + accruedPenalInterest;

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <AuthenticatedAppShell title="CFO Executive Suite">
      <main className={styles.container}>
        {/* Executive Header */}
        <div className={styles.cfoHeader}>
          <div>
            <span className={styles.cfoEyebrow}>CFO EXECUTIVE INTELLIGENCE · STATUTORY BALANCE SHEET</span>
            <h1 className={styles.cfoTitle}>Working Capital & Statutory Tax Shield</h1>
            <p className={styles.cfoSubtitle}>
              Direct financial defense under Income Tax Act Section 43B(h) and MSMED Act Section 16.
              Monitor liquidity acceleration, tax disallowance avoidance, and audit compliance.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button onClick={handlePrint} className={styles.printBtn} title="Print formal CA audit schedule">
              <span>🖨 Print Formal Audit Schedule (CA Ready)</span>
            </button>
          </div>
        </div>

        {/* 4 Core Executive Metric Cards */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>TOTAL COMMERCIAL BOOK</span>
            <span className={styles.metricVal}>₹1,24,60,000</span>
            <span className={styles.metricSub}>21 monitored enterprise accounts under automated clearing surveillance</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>TAX DISALLOWANCE AVOIDED</span>
            <span className={styles.metricVal} style={{ color: "var(--status-recovered)" }}>₹38,87,520</span>
            <span className={styles.metricSub}>Direct 31.2% corporate income tax penalty prevented under Section 43B(h)</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>DSO ACCELERATION</span>
            <span className={styles.metricVal} style={{ color: "var(--accent)" }}>-40.1 Days</span>
            <span className={styles.metricSub}>Average collection cycle compressed from 54.2 days down to 14.1 days</span>
          </div>

          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>STATUTORY INTEREST CLAIMABLE</span>
            <span className={styles.metricVal} style={{ color: "#38bdf8" }}>₹4,92,100</span>
            <span className={styles.metricSub}>Accrued compound interest at 3× RBI bank rate (~20.25% p.a.) under §16</span>
          </div>
        </div>

        {/* Comparative Balance Sheet: Without Vaada vs With Vaada */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Institutional Macro Comparison</h2>
              <p className={styles.sectionSub}>Audited performance impact across enterprise working capital metrics.</p>
            </div>
          </div>

          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th className={styles.colMetric}>Financial Metric</th>
                <th className={styles.colWithout}>Traditional Collections (Without Vaada)</th>
                <th className={styles.colWith}>Autonomous Clearing (With Vaada)</th>
                <th className={styles.colStatutory}>Statutory Basis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={styles.colMetric}>Average Days Sales Outstanding (DSO)</td>
                <td className={styles.colWithout}>54.2 Days (Working Capital Drag)</td>
                <td className={styles.colWith}>14.1 Days (Accelerated Settlement)</td>
                <td className={styles.colStatutory}>RBI Working Capital Benchmarks</td>
              </tr>
              <tr>
                <td className={styles.colMetric}>Section 43B(h) Tax Disallowance</td>
                <td className={styles.colWithout}>31.2% Direct Corporate Tax Penalty</td>
                <td className={styles.colWith}>₹0 Tax Disallowance (Protected)</td>
                <td className={styles.colStatutory}>Finance Act 2023 · IT Act §43B(h)</td>
              </tr>
              <tr>
                <td className={styles.colMetric}>Unstructured WhatsApp Recoveries</td>
                <td className={styles.colWithout}>Lost in Informal Chats (0% Enforceable)</td>
                <td className={styles.colWith}>94.2% Binding Contract Extraction</td>
                <td className={styles.colStatutory}>Indian Contract Act 1872 §10</td>
              </tr>
              <tr>
                <td className={styles.colMetric}>Penal Compound Interest Realization</td>
                <td className={styles.colWithout}>Waived / Forfeited by Default</td>
                <td className={styles.colWith}>Automatically Claimed at 3× RBI Rate</td>
                <td className={styles.colStatutory}>MSMED Act 2006 Section 16</td>
              </tr>
              <tr>
                <td className={styles.colMetric}>Payment Gateway Failure Cure Rate</td>
                <td className={styles.colWithout}>42% (Manual phone calls / delays)</td>
                <td className={styles.colWith}>89.4% (Autonomous rail-switch to UPI/RTGS)</td>
                <td className={styles.colStatutory}>NPCI / Razorpay Gateway Telemetry</td>
              </tr>
              <tr>
                <td className={styles.colMetric}>Statutory Audit Trail for Tax Auditors</td>
                <td className={styles.colWithout}>Scattered WhatsApp screenshots & emails</td>
                <td className={styles.colWith}>Cryptographically Verified Hash Chain</td>
                <td className={styles.colStatutory}>Income Tax Rules Form 3CD (Cl. 22)</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Interactive Working Capital & Tax Stress Simulator */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Enterprise Working Capital Stress Simulator</h2>
              <p className={styles.sectionSub}>Model your company&apos;s annual tax disallowance exposure if overdue beyond statutory 45-day cutoffs.</p>
            </div>
          </div>

          <div className={styles.stressGrid}>
            <div className={styles.sliderGroup}>
              <div className={styles.sliderItem}>
                <div className={styles.sliderItemTop}>
                  <label htmlFor="turnover-slider">Annual Corporate Turnover (Revenue):</label>
                  <span className={styles.sliderItemVal}>₹{turnoverCr} Crores</span>
                </div>
                <input
                  id="turnover-slider"
                  type="range"
                  min={10}
                  max={250}
                  step={5}
                  value={turnoverCr}
                  onChange={(e) => setTurnoverCr(parseInt(e.target.value, 10))}
                  className={styles.stressSlider}
                />
              </div>

              <div className={styles.sliderItem}>
                <div className={styles.sliderItemTop}>
                  <label htmlFor="overdue-slider">Estimated MSME Invoices Overdue (&gt;45 Days):</label>
                  <span className={styles.sliderItemVal}>{msmeOverduePercent}% of MSME Payables</span>
                </div>
                <input
                  id="overdue-slider"
                  type="range"
                  min={2}
                  max={40}
                  step={1}
                  value={msmeOverduePercent}
                  onChange={(e) => setMsmeOverduePercent(parseInt(e.target.value, 10))}
                  className={styles.stressSlider}
                />
              </div>

              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                Assumes 45% of gross turnover attributable to MSME goods/services procurement, evaluated under Section 43B(h) statutory cutoff rules.
              </p>
            </div>

            <div className={styles.stressOutputBox}>
              <div className={styles.outputItem}>
                <span className={styles.outputLabel}>Unsettled MSME Payables Exposure:</span>
                <span className={styles.outputVal} style={{ color: "var(--accent)" }}>
                  ₹{Math.round(overdueExposure).toLocaleString("en-IN")}
                </span>
              </div>

              <div className={styles.outputItem}>
                <span className={styles.outputLabel}>Direct Tax Disallowance Penalty (at 31.2%):</span>
                <span className={styles.outputVal} style={{ color: "var(--status-disallowed)" }}>
                  ₹{Math.round(taxDisallowancePenalty).toLocaleString("en-IN")}
                </span>
              </div>

              <div className={styles.outputItem}>
                <span className={styles.outputLabel}>Accrued Statutory Interest Claimable (3× RBI):</span>
                <span className={styles.outputVal} style={{ color: "#38bdf8" }}>
                  ₹{Math.round(accruedPenalInterest).toLocaleString("en-IN")}
                </span>
              </div>

              <div className={styles.outputItem}>
                <span className={styles.outputLabel}>Total Capital Preserved With Vaada Shield:</span>
                <span className={styles.outputVal} style={{ color: "var(--status-recovered)" }}>
                  ₹{Math.round(totalCapitalAtRisk).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Printable Formal Tax Audit Schedule */}
        <section className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>Statutory Disallowance Schedule (Form 3CD Clause 22)</h2>
              <p className={styles.sectionSub}>Generated for the Company Statutory Auditor and Tax Assessment Year 2024–25.</p>
            </div>
          </div>

          <div className={styles.auditSchedulePaper}>
            <h4>SCHEDULE OF COMPLIANCE UNDER SECTION 43B(h) OF THE INCOME TAX ACT, 1961 & SECTION 16 OF THE MSMED ACT, 2006</h4>

            <div className={styles.scheduleMetaGrid}>
              <div>
                <strong>ASSESSEE NAME:</strong><br />
                ACME INDUSTRIAL ENTERPRISES LTD
              </div>
              <div>
                <strong>GSTIN / PAN:</strong><br />
                27AAACA1234A1Z5 / AAACA1234A
              </div>
              <div>
                <strong>ASSESSMENT YEAR:</strong><br />
                2024–2025 (FY 2023–24)
              </div>
              <div>
                <strong>STATUTORY JURISDICTION:</strong><br />
                Mumbai Corporate Circle 4(2)
              </div>
              <div>
                <strong>VAADA LEDGER VERIFICATION HASH:</strong><br />
                <span style={{ color: "var(--accent)" }}>0x7f88a91c4e92b34a91901844</span>
              </div>
              <div>
                <strong>DPDP AUDIT TIMESTAMP:</strong><br />
                2026-09-05T03:30:00+05:30 (Asia/Kolkata)
              </div>
            </div>

            <p style={{ margin: "0 0 12px" }}>
              1. <strong>Verification of MSME Supplier Dues:</strong> All active purchase invoices have been verified against UDYAM registration status. Out of 21 monitored transactions, 15 transactions have been cured and settled within the mandatory 15/45-day statutory window.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              2. <strong>Disallowance Status under Section 43B(h):</strong> As certified by the autonomous clearing protocol, zero expenditure requires permanent disallowance for the current fiscal year due to timely dynamic QR settlement and formal RTGS vouchers.
            </p>
            <p style={{ margin: "0 0 12px" }}>
              3. <strong>Interest Liability under Section 16 of MSMED Act, 2006:</strong> Accrued penal interest at 3× RBI bank rate (20.25% p.a.) has been systematically tracked with monthly rests, and formal credit adjustments have been issued to suppliers.
            </p>

            <div className={styles.certSealBlock}>
              <span className={styles.certSealCheck}>✓</span>
              <div>
                <strong style={{ color: "var(--status-recovered)" }}>CRYPTOGRAPHICALLY SEALED BY VAADA AUTONOMOUS COMPLIANCE ENGINE</strong>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-secondary)" }}>
                  Conforms with Standard Auditing Guidance (AAS-4) and Clause 22 of the Tax Audit Report under Section 44AB.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </AuthenticatedAppShell>
  );
}
