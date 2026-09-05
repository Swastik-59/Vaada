"use client";

import { use, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedAppShell from "@/components/AuthenticatedAppShell";
import RazorpayWebhookModal from "@/components/RazorpayWebhookModal";
import styles from "../queue.module.css";

type CaseRow = {
  id: string;
  state: string;
  root_cause: string | null;
  recovery_probability: number | null;
  invoice_number: string | null;
  amount_minor: number | null;
  currency: string | null;
  due_at: string | null;
  contact_attempt_count: number;
  customer_name?: string | null;
  customer_gstin?: string | null;
  customer_is_msme?: boolean;
  customer_msme_category?: string | null;
  statutory_interest_minor?: number;
  credit_risk_tier?: string;
  statutory_status?: {
    days_remaining: number;
    is_disallowed: boolean;
    is_msme: boolean;
    statutory_interest_minor: number;
  } | null;
};

type Metrics = {
  open_cases: number;
  recovered_cases: number;
  recovered_amount_minor: number;
  statutory_interest_minor?: number;
  msme_43b_h_at_risk_cases?: number;
};

const HUMAN_STATE_DESCRIPTIONS: Record<string, { label: string; actionHint: string; color: string }> = {
  open: { label: "Ingested", actionHint: "Classifying gateway error", color: "var(--text-secondary)" },
  classified: { label: "Diagnosed", actionHint: "Evaluating recovery policy", color: "var(--text-secondary)" },
  awaiting_action: { label: "Action Pending", actionHint: "Ready for payment reminder", color: "var(--accent, #c4943a)" },
  contacted: { label: "Debtor Contacted", actionHint: "WhatsApp delivery sent", color: "var(--accent, #c4943a)" },
  awaiting_response: { label: "Awaiting Reply", actionHint: "Waiting on customer commitment", color: "var(--accent, #c4943a)" },
  promise_recorded: { label: "Promise Committed", actionHint: "Debtor scheduled payment", color: "var(--status-recovered, #22c55e)" },
  human_review: { label: "Operator Review", actionHint: "Dispute or terms query", color: "#a855f7" },
  paused: { label: "Temporarily Paused", actionHint: "Debtor requested grace period", color: "var(--text-muted)" },
  blocked: { label: "Compliance Blocked", actionHint: "Exceeded contact caps", color: "var(--status-disallowed, #f87171)" },
  recovered: { label: "Settled & Verified", actionHint: "Bank remittance matched", color: "var(--status-recovered, #22c55e)" },
  unrecoverable: { label: "Marked Bad Debt", actionHint: "Exhausted statutory rails", color: "var(--status-disallowed, #f87171)" },
};

function formatCurrency(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return "₹" + Math.round(minor / 100).toLocaleString("en-IN");
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type SortKey = "amount_minor" | "recovery_probability" | "due_at" | null;

export default function CanonicalQueuePage({ params }: { params: Promise<{ uid: string }> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Sample data generation state
  const [selectedScenario, setSelectedScenario] = useState("mixed");
  const [generatingSample, setGeneratingSample] = useState(false);

  // Filters & Search
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("amount_minor");
  const [sortAsc, setSortAsc] = useState(false);

  async function loadCases() {
    try {
      setLoading(true);
      setError("");
      const data = await apiFetch("/api/v1/cases?limit=50");
      setItems(data.items ?? []);
      if (data.metrics) setMetrics(data.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCases();
  }, []);

  async function handleGenerateSampleData() {
    try {
      setGeneratingSample(true);
      await apiFetch("/api/v1/tenant/sample-data", {
        method: "POST",
        body: JSON.stringify({ scenario: selectedScenario, count: 6 }),
      });
      await loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate sample data");
    } finally {
      setGeneratingSample(false);
    }
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = useMemo(() => {
    let result = items;
    if (stateFilter) {
      result = result.filter((i) => i.state === stateFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          (i.invoice_number || "").toLowerCase().includes(q) ||
          (i.customer_name || "").toLowerCase().includes(q) ||
          (i.customer_gstin || "").toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        return sortAsc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
      });
    }
    return result;
  }, [items, stateFilter, searchQuery, sortKey, sortAsc]);

  const highestPriorityCase = useMemo(() => {
    return (
      items.find((c) => c.state === "human_review") ||
      items.find(
        (c) =>
          c.statutory_status?.days_remaining != null &&
          c.statutory_status.days_remaining <= 5 &&
          !c.statutory_status.is_disallowed
      ) ||
      items[0]
    );
  }, [items]);

  return (
    <AuthenticatedAppShell expectedUid={resolvedParams.uid} title="Recovery Queue">
      <div className={styles.workspace}>
        {/* Header Strip */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageHeadline}>Commercial Receivables</h1>
            <p className={styles.pageSubheadline}>
              Prioritized invoices under automated surveillance, debtor communication, and Section 43B(h) compliance.
            </p>
          </div>

          {/* Portfolio Health Summary Strip */}
          {metrics && items.length > 0 && (
            <div className={styles.metricsSummaryStrip}>
              <div className={styles.metricItem}>
                <span className={styles.mLabel}>ACTIVE PORTFOLIO</span>
                <span className={styles.mValue}>{metrics.open_cases} Cases</span>
                <span className={styles.mMeta}>Under recovery</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.mLabel}>SETTLED & RECONCILED</span>
                <span className={styles.mValue} style={{ color: "var(--status-recovered, #22c55e)" }}>
                  {formatCurrency(metrics.recovered_amount_minor)}
                </span>
                <span className={styles.mMeta}>{metrics.recovered_cases} Invoices paid</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.mLabel}>SECTION 43B(h) AT RISK</span>
                <span className={styles.mValue} style={{ color: "var(--status-disallowed, #f87171)" }}>
                  {metrics.msme_43b_h_at_risk_cases ?? 0}
                </span>
                <span className={styles.mMeta}>MSME 45-day cutoff</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.mLabel}>3× STATUTORY PENAL ACCRUED</span>
                <span className={styles.mValue} style={{ color: "var(--accent, #c4943a)" }}>
                  {formatCurrency(metrics.statutory_interest_minor ?? 0)}
                </span>
                <span className={styles.mMeta}>MSMED Act claimable</span>
              </div>
            </div>
          )}
        </header>

        {/* Highest Priority Attention Banner */}
        {highestPriorityCase && items.length > 0 && (
          <div className={styles.attentionBanner}>
            <div className={styles.attnLeft}>
              <span className={styles.attnTag}>RECOMMENDED OPERATOR FOCUS</span>
              <h3 className={styles.attnTitle}>
                {highestPriorityCase.customer_name} — {highestPriorityCase.invoice_number} (
                {formatCurrency(highestPriorityCase.amount_minor)})
              </h3>
              <p className={styles.attnDetail}>
                {highestPriorityCase.state === "human_review"
                  ? "Requires human adjudication: Debtor raised payment terms query or disputed invoice."
                  : highestPriorityCase.statutory_status?.days_remaining != null &&
                    highestPriorityCase.statutory_status.days_remaining <= 5
                  ? `Critical Section 43B(h) deadline: ${highestPriorityCase.statutory_status.days_remaining} days left before debtor incurs 31.2% corporate tax disallowance.`
                  : "Active promise scheduled on WhatsApp. Ready for automated reminder verification."}
              </p>
            </div>
            <Link href={`/cases/${highestPriorityCase.id}`} className={styles.attnActionBtn}>
              Inspect Dossier →
            </Link>
          </div>
        )}

        {/* Error Notification */}
        {error && <div className={styles.errorNotice}>Notice: {error}</div>}

        {/* ── Empty State / Tenant Onboarding ── */}
        {!loading && items.length === 0 && (
          <div className={styles.onboardingCard}>
            <span className={styles.onboardingBadge}>Workspace Ready · Clean State</span>
            <h2 className={styles.onboardingTitle}>
              Welcome to {user?.tenant_name || "Your Organization"}
            </h2>
            <p className={styles.onboardingDesc}>
              Your bounded recovery ledger is initialized with zero active cases. To begin testing recovery
              workflows, simulate incoming Razorpay webhook failures, or generate a realistic synthetic portfolio.
            </p>

            <div className={styles.onboardingActions}>
              <div className={styles.scenarioControls}>
                <button
                  className={`${styles.scenarioChip} ${selectedScenario === "mixed" ? styles.scenarioChipActive : ""}`}
                  onClick={() => setSelectedScenario("mixed")}
                >
                  Mixed Portfolio
                </button>
                <button
                  className={`${styles.scenarioChip} ${selectedScenario === "msme_43b_h" ? styles.scenarioChipActive : ""}`}
                  onClick={() => setSelectedScenario("msme_43b_h")}
                >
                  MSME §43B(h) Critical
                </button>
                <button
                  className={`${styles.scenarioChip} ${selectedScenario === "payment_failures" ? styles.scenarioChipActive : ""}`}
                  onClick={() => setSelectedScenario("payment_failures")}
                >
                  Payment Failures
                </button>
                <button
                  className={`${styles.scenarioChip} ${selectedScenario === "hinglish_promissory" ? styles.scenarioChipActive : ""}`}
                  onClick={() => setSelectedScenario("hinglish_promissory")}
                >
                  Hinglish Promissory
                </button>
              </div>

              <button
                className={styles.primaryGenerateBtn}
                onClick={handleGenerateSampleData}
                disabled={generatingSample}
              >
                {generatingSample ? "Generating Coherent Dataset..." : "⚡ Generate Sample Data"}
              </button>

              <div className={styles.secondaryActionRow}>
                <button className={styles.secondaryBtn} onClick={() => setIsSimulatorOpen(true)}>
                  Simulate Gateway Webhook
                </button>
              </div>

              <p className={styles.provenanceNote}>
                Synthetic demo records are isolated strictly to your organization and can be cleared at any time in Settings.
              </p>
            </div>
          </div>
        )}

        {/* ── Active Queue Table & Cards ── */}
        {items.length > 0 && (
          <>
            {/* Controls: Search and Filters */}
            <div className={styles.controlsRow}>
              <div className={styles.searchBox}>
                <input
                  type="text"
                  placeholder="Search by buyer, invoice, or GSTIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.filterPills}>
                <button
                  className={stateFilter === null ? styles.pillActive : styles.pill}
                  onClick={() => setStateFilter(null)}
                >
                  All ({items.length})
                </button>
                <button
                  className={stateFilter === "promise_recorded" ? styles.pillActive : styles.pill}
                  onClick={() => setStateFilter("promise_recorded")}
                >
                  Promise Recorded
                </button>
                <button
                  className={stateFilter === "human_review" ? styles.pillActive : styles.pill}
                  onClick={() => setStateFilter("human_review")}
                >
                  Needs Review
                </button>
                <button
                  className={stateFilter === "awaiting_action" ? styles.pillActive : styles.pill}
                  onClick={() => setStateFilter("awaiting_action")}
                >
                  Action Pending
                </button>
                <button
                  className={stateFilter === "recovered" ? styles.pillActive : styles.pill}
                  onClick={() => setStateFilter("recovered")}
                >
                  Settled
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className={styles.ledgerTableContainer}>
              <table className={styles.ledgerTable}>
                <thead>
                  <tr>
                    <th>ENTERPRISE BUYER</th>
                    <th>INVOICE NUMBER</th>
                    <th onClick={() => toggleSort("amount_minor")} className={styles.sortableHeader}>
                      PRINCIPAL VALUE {sortKey === "amount_minor" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th onClick={() => toggleSort("due_at")} className={styles.sortableHeader}>
                      DUE DATE {sortKey === "due_at" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th>SECTION 43B(h) CLOCK</th>
                    <th onClick={() => toggleSort("recovery_probability")} className={styles.sortableHeader}>
                      PROBABILITY {sortKey === "recovery_probability" ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                    <th>STATUS & ACTION</th>
                    <th className={styles.textRight}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const desc = HUMAN_STATE_DESCRIPTIONS[item.state] || {
                      label: item.state,
                      actionHint: "Processing",
                      color: "var(--text-secondary)",
                    };
                    const stat = item.statutory_status;

                    return (
                      <tr key={item.id} className={styles.tableRow}>
                        <td>
                          <div className={styles.buyerCell}>
                            <span className={styles.buyerName}>{item.customer_name || "Enterprise Buyer"}</span>
                            <span className={styles.buyerGstin}>{item.customer_gstin || "GSTIN Pending"}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.invoiceCell}>
                            <span className={styles.invoiceNum}>{item.invoice_number}</span>
                            {item.customer_is_msme && (
                              <span className={styles.msmeTag}>
                                MSME {item.customer_msme_category || ""}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className={styles.principalNumber}>
                            {formatCurrency(item.amount_minor)}
                          </div>
                          {item.statutory_interest_minor != null && item.statutory_interest_minor > 0 && (
                            <div className={styles.interestNote}>
                              +{formatCurrency(item.statutory_interest_minor)} penal
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={styles.dateNumber}>{formatDate(item.due_at)}</span>
                        </td>
                        <td>
                          {stat ? (
                            stat.is_disallowed ? (
                              <span className={styles.clockDisallowed}>
                                Tax Deduction Disallowed (31.2% Penalty)
                              </span>
                            ) : stat.days_remaining <= 5 ? (
                              <span className={styles.clockCritical}>
                                {stat.days_remaining}d remaining (Critical)
                              </span>
                            ) : (
                              <span className={styles.clockSafe}>
                                {stat.days_remaining}d remaining
                              </span>
                            )
                          ) : (
                            <span className={styles.clockNonMsme}>Standard Terms</span>
                          )}
                        </td>
                        <td>
                          <div className={styles.likelihoodWrap}>
                            <div className={styles.likelihoodTrack}>
                              <div
                                className={styles.likelihoodFill}
                                style={{
                                  width: `${Math.round((item.recovery_probability ?? 0.5) * 100)}%`,
                                  backgroundColor:
                                    (item.recovery_probability ?? 0) >= 0.7
                                      ? "var(--status-recovered, #22c55e)"
                                      : (item.recovery_probability ?? 0) >= 0.4
                                      ? "var(--accent, #c4943a)"
                                      : "var(--status-disallowed, #f87171)",
                                }}
                              />
                            </div>
                            <span className={styles.likelihoodNum}>
                              {item.recovery_probability != null
                                ? `${Math.round(item.recovery_probability * 100)}%`
                                : "—"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <span className={styles.stateLabel} style={{ color: desc.color }}>
                              ● {desc.label}
                            </span>
                            <span className={styles.actionHint}>{desc.actionHint}</span>
                          </div>
                        </td>
                        <td className={styles.textRight}>
                          <Link href={`/cases/${item.id}`} className={styles.inspectBtn}>
                            Inspect Dossier
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className={styles.mobileCardsContainer}>
              {filtered.map((item) => {
                const desc = HUMAN_STATE_DESCRIPTIONS[item.state] || {
                  label: item.state,
                  actionHint: "Processing",
                  color: "var(--text-secondary)",
                };
                return (
                  <div key={item.id} className={styles.mobileCaseCard}>
                    <div className={styles.mobileCardHeader}>
                      <div>
                        <div className={styles.mobileCustomerName}>{item.customer_name}</div>
                        <div className={styles.mobileInvoiceNum}>{item.invoice_number}</div>
                      </div>
                      <span className={styles.stateLabel} style={{ color: desc.color }}>
                        ● {desc.label}
                      </span>
                    </div>
                    <div className={styles.mobileCardMetrics}>
                      <div>
                        <span className={styles.mLabel}>AMOUNT</span>
                        <div className={styles.principalNumber}>{formatCurrency(item.amount_minor)}</div>
                      </div>
                      <div>
                        <span className={styles.mLabel}>DUE</span>
                        <div className={styles.dateNumber}>{formatDate(item.due_at)}</div>
                      </div>
                      <div>
                        <span className={styles.mLabel}>PROBABILITY</span>
                        <div className={styles.likelihoodNum}>
                          {item.recovery_probability != null
                            ? `${Math.round(item.recovery_probability * 100)}%`
                            : "—"}
                        </div>
                      </div>
                    </div>
                    <Link href={`/cases/${item.id}`} className={styles.inspectBtn} style={{ textAlign: "center" }}>
                      Inspect Case Dossier →
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Razorpay Webhook Simulation Modal */}
      {isSimulatorOpen && (
        <RazorpayWebhookModal
          isOpen={isSimulatorOpen}
          onClose={() => setIsSimulatorOpen(false)}
          onEventProcessed={() => {
            setIsSimulatorOpen(false);
            loadCases();
          }}
        />
      )}
    </AuthenticatedAppShell>
  );
}
