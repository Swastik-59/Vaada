"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import DashboardNav from "@/components/DashboardNav";
import styles from "./analytics.module.css";

type FunnelConversion = {
  ingested_to_classified: number;
  classified_to_contacted: number;
  contacted_to_promised: number;
  promised_to_recovered: number;
  overall_recovery_rate: number;
};

type AnalyticsData = {
  open_cases?: number;
  recovered_cases?: number;
  recovered_amount_minor?: number;
  statutory_interest_minor?: number;
  msme_43b_h_at_risk_cases?: number;
  portfolio: {
    total_receivables_minor: number;
    total_overdue_minor: number;
    recovered_amount_minor: number;
    recoverable_estimate_minor: number;
    recovery_rate_percent: number;
    total_cases: number;
    active_cases: number;
    recovered_cases: number;
  };
  statutory_risk: {
    total_penal_interest_minor: number;
    tax_deduction_at_risk_minor: number;
    msme_disallowed_count: number;
    msme_at_risk_count: number;
    msme_safe_count: number;
  };
  funnel: {
    ingested: number;
    classified: number;
    contacted: number;
    promised: number;
    recovered: number;
    conversion_rates: FunnelConversion;
  };
  aging_buckets: Record<string, { count: number; amount_minor: number }>;
  root_cause_distribution: Record<string, { count: number; amount_minor: number; recovered_count: number }>;
  promises: {
    total_promises: number;
    broken_promises: number;
    adherence_rate_percent: number;
  };
  calculated_at: string;
};

type UserProfile = {
  user_id: string;
  email: string;
  tenant_id: string;
  role: string;
};

function formatCurrency(minor: number = 0): string {
  const inr = minor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(inr);
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [jobTriggering, setJobTriggering] = useState(false);
  const [jobResult, setJobResult] = useState<any | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/api/v1/metrics");
      setData(res);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load portfolio metrics:", err);
      setError(err.message || "Failed to load institutional analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Fetch user session
    apiFetch("/api/v1/auth/me")
      .then((res) => {
        if (res && res.email) {
          setUser(res);
        }
      })
      .catch(() => {
        // Not logged in or guest session
      });

    // 2. Fetch analytics
    fetchAnalytics();
  }, []);

  const handleTriggerJobs = async () => {
    try {
      setJobTriggering(true);
      setJobResult(null);
      const res = await apiFetch("/api/v1/jobs/trigger", {
        method: "POST",
        body: JSON.stringify({ job_name: "all", stale_days: 7 }),
      });
      setJobResult(res);
      // Refresh analytics to reflect any status changes immediately
      await fetchAnalytics();
    } catch (err: any) {
      alert(`Job execution failed: ${err.message}`);
    } finally {
      setJobTriggering(false);
    }
  };

  if (loading && !data) {
    return (
      <div className={styles.shell}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            Computing portfolio state & statutory exposure...
          </div>
        </div>
      </div>
    );
  }

  const p = data?.portfolio;
  const s = data?.statutory_risk;
  const f = data?.funnel;

  return (
    <div className={styles.shell}>
      {/* ── Top Executive Navigation ── */}
      <DashboardNav title="Institutional Analytics" user={user} />

      {/* ── Workspace ── */}
      <main className={styles.workspace}>
        {/* Header Strip */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageHeadline}>Portfolio Surveillance & Recovery Intelligence</h1>
            <p className={styles.pageSubheadline}>
              Real-time commercial debt recovery velocity, Section 43B(h) tax disallowance exposure, and algorithmic recovery projections.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              onClick={handleTriggerJobs}
              disabled={jobTriggering}
              className={styles.triggerJobsButton}
              title="Run promise adherence verification, stale case checks, and IST compliance sweeper now"
            >
              {jobTriggering ? (
                <>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⚙️</span>
                  <span>Executing Surveillance...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Run Surveillance Jobs</span>
                </>
              )}
            </button>
          </div>
        </header>

        {/* Job Execution Notification */}
        {jobResult && (
          <div className={styles.jobResultBanner}>
            <div>
              <strong>✓ Background Surveillance Completed:</strong>{" "}
              {jobResult.results?.promise_adherence?.broken_promises_detected ?? 0} broken promises flagged,{" "}
              {jobResult.results?.promise_adherence?.t_minus_1_reminders_triggered ?? 0} reminders scheduled,{" "}
              {jobResult.results?.stale_cases?.stale_cases_flagged ?? 0} stale cases surfaced.
            </div>
            <button
              onClick={() => setJobResult(null)}
              style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Hero Metrics Grid ── */}
        <section className={styles.heroGrid}>
          {/* Total Receivables */}
          <div className={styles.metricCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>Total Commercial Book</span>
              <span className={styles.cardBadge}>Active</span>
            </div>
            <div className={styles.cardValue}>{formatCurrency(p?.total_receivables_minor)}</div>
            <div className={styles.cardMeta}>
              {p?.total_cases} managed cases across current accounting periods
            </div>
          </div>

          {/* Cash Settled */}
          <div className={`${styles.metricCard} ${styles.metricCardGlowRecovered}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>Remitted to Bank</span>
              <span className={`${styles.cardBadge} ${styles.badgeRecovered}`}>
                {p?.recovery_rate_percent}% Settled
              </span>
            </div>
            <div className={styles.cardValue} style={{ color: "var(--status-recovered)" }}>
              {formatCurrency(p?.recovered_amount_minor)}
            </div>
            <div className={styles.cardMeta}>
              {p?.recovered_cases} cases verified via bank/webhook reconciliation
            </div>
          </div>

          {/* Overdue & Recoverable Estimate */}
          <div className={`${styles.metricCard} ${styles.metricCardGlowAccent}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>Algorithmic Recoverable</span>
              <span className={`${styles.cardBadge} ${styles.badgeAmber}`}>ML Expected</span>
            </div>
            <div className={styles.cardValue} style={{ color: "var(--accent-text)" }}>
              {formatCurrency(p?.recoverable_estimate_minor)}
            </div>
            <div className={styles.cardMeta}>
              Out of {formatCurrency(p?.total_overdue_minor)} in active arrears
            </div>
          </div>

          {/* 43B(h) Statutory Exposure */}
          <div className={`${styles.metricCard} ${styles.metricCardGlowRisk}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>Section 43B(h) At Risk</span>
              <span className={`${styles.cardBadge} ${styles.badgeRisk}`}>
                {(s?.msme_disallowed_count ?? 0) + (s?.msme_at_risk_count ?? 0)} MSME Invoices
              </span>
            </div>
            <div className={styles.cardValue} style={{ color: "var(--status-disallowed)" }}>
              {formatCurrency(s?.tax_deduction_at_risk_minor)}
            </div>
            <div className={styles.cardMeta}>
              3x RBI Penal Interest Accrued: <strong>{formatCurrency(s?.total_penal_interest_minor)}</strong>
            </div>
          </div>
        </section>

        {/* ── Dual Panel: Funnel & 43B(h) Statutory Risk Meter ── */}
        <section className={styles.dualSection}>
          {/* Funnel */}
          <div className={styles.panel}>
            <div>
              <h2 className={styles.panelTitle}>
                <span>Institutional Recovery Funnel</span>
                <span style={{ fontSize: "0.75rem", fontFamily: "var(--mono)", color: "var(--text-muted)" }}>
                  End-to-End Resolution Rate: {f?.conversion_rates.overall_recovery_rate}%
                </span>
              </h2>
              <p className={styles.panelSubtitle}>
                Progression of payment failure events through automated diagnostics, structured outreach, and settlement.
              </p>
            </div>

            <div className={styles.funnelContainer}>
              {/* Step 1: Ingested */}
              <div className={styles.funnelStep}>
                <div className={styles.funnelStepHeader}>
                  <span className={styles.stepName}>1. Gateway Events Ingested</span>
                  <span className={styles.stepValue}>{f?.ingested} cases</span>
                </div>
                <div className={styles.funnelBarTrack}>
                  <div
                    className={styles.funnelBarFill}
                    style={{ width: "100%", backgroundColor: "var(--neutral-8)" }}
                  >
                    <span className={styles.funnelConversionText}>100% baseline</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Diagnosed */}
              <div className={styles.funnelStep}>
                <div className={styles.funnelStepHeader}>
                  <span className={styles.stepName}>2. Razorpay Error Diagnosed</span>
                  <span className={styles.stepValue}>
                    {f?.classified} cases ({f?.conversion_rates.ingested_to_classified}%)
                  </span>
                </div>
                <div className={styles.funnelBarTrack}>
                  <div
                    className={styles.funnelBarFill}
                    style={{
                      width: `${Math.max(10, f?.conversion_rates.ingested_to_classified ?? 0)}%`,
                      backgroundColor: "var(--status-info)",
                    }}
                  >
                    <span className={styles.funnelConversionText}>
                      {f?.conversion_rates.ingested_to_classified}% classified
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: Contacted */}
              <div className={styles.funnelStep}>
                <div className={styles.funnelStepHeader}>
                  <span className={styles.stepName}>3. Compliant Outbound Contacted</span>
                  <span className={styles.stepValue}>
                    {f?.contacted} cases ({f?.conversion_rates.classified_to_contacted}%)
                  </span>
                </div>
                <div className={styles.funnelBarTrack}>
                  <div
                    className={styles.funnelBarFill}
                    style={{
                      width: `${Math.max(10, ((f?.contacted ?? 0) / (f?.ingested || 1)) * 100)}%`,
                      backgroundColor: "var(--status-warning)",
                    }}
                  >
                    <span className={styles.funnelConversionText}>
                      {f?.conversion_rates.classified_to_contacted}% outreach
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 4: Promised */}
              <div className={styles.funnelStep}>
                <div className={styles.funnelStepHeader}>
                  <span className={styles.stepName}>4. Debtor Commitment Extracted</span>
                  <span className={styles.stepValue}>
                    {f?.promised} cases ({f?.conversion_rates.contacted_to_promised}%)
                  </span>
                </div>
                <div className={styles.funnelBarTrack}>
                  <div
                    className={styles.funnelBarFill}
                    style={{
                      width: `${Math.max(10, ((f?.promised ?? 0) / (f?.ingested || 1)) * 100)}%`,
                      backgroundColor: "var(--accent)",
                    }}
                  >
                    <span className={styles.funnelConversionText}>
                      {f?.conversion_rates.contacted_to_promised}% commitment
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 5: Recovered */}
              <div className={styles.funnelStep}>
                <div className={styles.funnelStepHeader}>
                  <span className={styles.stepName}>5. Cash Settled & Reconciled</span>
                  <span className={styles.stepValue} style={{ color: "var(--status-recovered)" }}>
                    {f?.recovered} cases ({f?.conversion_rates.promised_to_recovered}%)
                  </span>
                </div>
                <div className={styles.funnelBarTrack}>
                  <div
                    className={styles.funnelBarFill}
                    style={{
                      width: `${Math.max(10, ((f?.recovered ?? 0) / (f?.ingested || 1)) * 100)}%`,
                      backgroundColor: "var(--status-recovered)",
                    }}
                  >
                    <span className={styles.funnelConversionText}>
                      {f?.conversion_rates.overall_recovery_rate}% recovered
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Statutory Risk Meter */}
          <div className={styles.panel}>
            <div>
              <h2 className={styles.panelTitle}>
                <span>MSME Statutory Risk (Section 43B(h))</span>
                <Link href="/queue" className={styles.actionLink}>
                  Inspect in Queue →
                </Link>
              </h2>
              <p className={styles.panelSubtitle}>
                Income Tax Act compliance enforcing disallowance on overdue MSME invoices past 15/45-day statutory cutoffs.
              </p>
            </div>

            <div className={styles.disallowanceMeterBox}>
              <div className={styles.meterRow}>
                <span className={styles.meterLabel}>Statutory Deduction Status</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Tax Year 2024–25
                </span>
              </div>

              {/* Progress split */}
              <div className={styles.meterProgressBar}>
                <div
                  className={styles.meterSegmentDanger}
                  style={{
                    width: `${
                      ((s?.msme_disallowed_count ?? 0) /
                        Math.max(1, (s?.msme_disallowed_count ?? 0) + (s?.msme_at_risk_count ?? 0) + (s?.msme_safe_count ?? 0))) *
                      100
                    }%`,
                  }}
                  title="Disallowed"
                />
                <div
                  className={styles.meterSegmentWarning}
                  style={{
                    width: `${
                      ((s?.msme_at_risk_count ?? 0) /
                        Math.max(1, (s?.msme_disallowed_count ?? 0) + (s?.msme_at_risk_count ?? 0) + (s?.msme_safe_count ?? 0))) *
                      100
                    }%`,
                  }}
                  title="At Risk (<10 days)"
                />
                <div
                  className={styles.meterSegmentSafe}
                  style={{
                    width: `${
                      ((s?.msme_safe_count ?? 0) /
                        Math.max(1, (s?.msme_disallowed_count ?? 0) + (s?.msme_at_risk_count ?? 0) + (s?.msme_safe_count ?? 0))) *
                      100
                    }%`,
                  }}
                  title="Compliant / Safe"
                />
              </div>

              <div className={styles.meterRow}>
                <span className={styles.meterLabel}>🔴 Disallowed (Past Cutoff):</span>
                <span className={styles.meterValDanger}>{s?.msme_disallowed_count ?? 0} invoices</span>
              </div>

              <div className={styles.meterRow}>
                <span className={styles.meterLabel}>🟡 At Risk (≤ 10 Days Remaining):</span>
                <span className={styles.meterValWarning}>{s?.msme_at_risk_count ?? 0} invoices</span>
              </div>

              <div className={styles.meterRow}>
                <span className={styles.meterLabel}>🟢 Safe (&gt; 10 Days Remaining):</span>
                <span className={styles.meterValSafe}>{s?.msme_safe_count ?? 0} invoices</span>
              </div>

              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                <div className={styles.meterRow}>
                  <span className={styles.meterLabel}>Statutory 3x RBI Penal Interest:</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--status-disallowed)" }}>
                    {formatCurrency(s?.total_penal_interest_minor)}
                  </span>
                </div>
                <div className={styles.meterRow} style={{ marginTop: "0.35rem" }}>
                  <span className={styles.meterLabel}>Total Disallowable Expense:</span>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: "var(--text-emphasis)" }}>
                    {formatCurrency(s?.tax_deduction_at_risk_minor)}
                  </span>
                </div>
              </div>
            </div>

            {/* Promise Adherence summary */}
            <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                  Debtor Promise-to-Pay Adherence
                </span>
                <span style={{ fontFamily: "var(--mono)", fontSize: "0.8125rem", color: "var(--accent-text)", fontWeight: 600 }}>
                  {data?.promises.adherence_rate_percent}% Honor Rate
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                {data?.promises.total_promises} recorded settlement commitments extracted via Hinglish NLP. {data?.promises.broken_promises} defaulted or required second-order human escalation.
              </div>
            </div>
          </div>
        </section>

        {/* ── Secondary Grid: Root Cause Distribution & Arrears Aging ── */}
        <section className={styles.secondaryGrid}>
          {/* Razorpay Failure Taxonomy Breakdown */}
          <div className={styles.panel}>
            <div>
              <h2 className={styles.panelTitle}>
                <span>Payment Gateway Failure Breakdown</span>
                <Link href="/razorpay-taxonomy" className={styles.actionLink}>
                  Taxonomy Dictionary →
                </Link>
              </h2>
              <p className={styles.panelSubtitle}>
                Categorization of commercial payment failures mapped from Razorpay gateway error codes.
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Root Cause</th>
                    <th>Volume</th>
                    <th>Total Arrears</th>
                    <th>Cured</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.root_cause_distribution &&
                    Object.entries(data.root_cause_distribution).map(([cause, details]) => (
                      <tr key={cause}>
                        <td>
                          <span className={styles.tagPill}>{cause.replace(/_/g, " ")}</span>
                        </td>
                        <td className={styles.monoCol}>{details.count}</td>
                        <td className={styles.monoCol}>{formatCurrency(details.amount_minor)}</td>
                        <td className={styles.monoCol}>
                          <span style={{ color: details.recovered_count > 0 ? "var(--status-recovered)" : "var(--text-muted)" }}>
                            {details.recovered_count} / {details.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Arrears Aging Buckets */}
          <div className={styles.panel}>
            <div>
              <h2 className={styles.panelTitle}>
                <span>Arrears Aging Analysis</span>
                <span style={{ fontSize: "0.75rem", fontFamily: "var(--mono)", color: "var(--text-muted)" }}>
                  Days Overdue
                </span>
              </h2>
              <p className={styles.panelSubtitle}>
                Aging brackets monitoring the critical 45-day statutory threshold for commercial debt.
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Aging Bracket</th>
                    <th>Risk Severity</th>
                    <th>Cases</th>
                    <th>Outstanding Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className={styles.tagPill}>0 – 30 Days</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--status-info)", fontSize: "0.75rem", fontWeight: 600 }}>
                        Normal Cure
                      </span>
                    </td>
                    <td className={styles.monoCol}>{data?.aging_buckets["0_30_days"]?.count ?? 0}</td>
                    <td className={styles.monoCol}>
                      {formatCurrency(data?.aging_buckets["0_30_days"]?.amount_minor ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className={styles.tagPill}>31 – 60 Days</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--accent-text)", fontSize: "0.75rem", fontWeight: 600 }}>
                        ⚠ MSME 45-Day Threshold
                      </span>
                    </td>
                    <td className={styles.monoCol}>{data?.aging_buckets["31_60_days"]?.count ?? 0}</td>
                    <td className={styles.monoCol}>
                      {formatCurrency(data?.aging_buckets["31_60_days"]?.amount_minor ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className={styles.tagPill}>61 – 90 Days</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--status-disallowed)", fontSize: "0.75rem", fontWeight: 600 }}>
                        High Disallowance Risk
                      </span>
                    </td>
                    <td className={styles.monoCol}>{data?.aging_buckets["61_90_days"]?.count ?? 0}</td>
                    <td className={styles.monoCol}>
                      {formatCurrency(data?.aging_buckets["61_90_days"]?.amount_minor ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <span className={styles.tagPill}>90+ Days</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--status-disallowed)", fontSize: "0.75rem", fontWeight: 700 }}>
                        Severe Default / Legal
                      </span>
                    </td>
                    <td className={styles.monoCol}>{data?.aging_buckets["90_plus_days"]?.count ?? 0}</td>
                    <td className={styles.monoCol}>
                      {formatCurrency(data?.aging_buckets["90_plus_days"]?.amount_minor ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
