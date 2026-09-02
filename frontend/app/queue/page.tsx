"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import styles from "./queue.module.css";

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

const STATE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: "Open", color: "var(--text-secondary)", bg: "var(--bg-elevated)" },
  classified: { label: "Classified", color: "var(--text-secondary)", bg: "var(--bg-elevated)" },
  awaiting_action: { label: "Awaiting Action", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.1)" },
  contacted: { label: "Contacted", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" },
  awaiting_response: { label: "Awaiting Reply", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.1)" },
  promise_recorded: { label: "Promise Recorded", color: "#34d399", bg: "rgba(52, 211, 153, 0.1)" },
  human_review: { label: "Human Review", color: "#f97316", bg: "rgba(249, 115, 22, 0.1)" },
  paused: { label: "Paused", color: "var(--text-muted)", bg: "var(--bg-elevated)" },
  blocked: { label: "Blocked", color: "#f87171", bg: "rgba(248, 113, 113, 0.1)" },
  recovered: { label: "Recovered", color: "var(--color-recovered)", bg: "rgba(16, 185, 129, 0.1)" },
  unrecoverable: { label: "Unrecoverable", color: "var(--color-disallowed)", bg: "rgba(239, 68, 68, 0.1)" },
  cancelled: { label: "Cancelled", color: "var(--text-muted)", bg: "var(--bg-elevated)" },
};

const ALL_STATES = [
  "awaiting_action",
  "awaiting_response",
  "promise_recorded",
  "human_review",
  "recovered",
  "unrecoverable",
];

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

export default function QueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/cases?limit=50")
      .then((data) => {
        setItems(data.items ?? []);
        if (data.metrics) setMetrics(data.metrics);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          setIsUnauthorized(true);
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  let displayed = items;
  if (stateFilter) {
    displayed = displayed.filter((i) => i.state === stateFilter);
  }
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    displayed = displayed.filter(
      (i) =>
        (i.invoice_number || "").toLowerCase().includes(q) ||
        (i.customer_name || "").toLowerCase().includes(q) ||
        (i.customer_gstin || "").toLowerCase().includes(q)
    );
  }
  if (sortKey) {
    displayed = [...displayed].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortAsc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }

  return (
    <div className={styles.shell}>
      {/* ── Top Navigation ── */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.navBrand}>
            VAADA <span className={styles.navDevanagari}>वादा</span>
          </Link>
          <span className={styles.navDivider}>/</span>
          <span className={styles.navTitle}>OPERATIONS CONSOLE</span>
        </div>
        <div className={styles.navRight}>
          <Link href="/" className={styles.navLink}>Public Machine</Link>
          <Link href="/audit" className={styles.navLink}>Audit Trail</Link>
          <Link href="/settings" className={styles.navLink}>Compliance</Link>
          <Link href="/razorpay-taxonomy" className={styles.navLink}>Taxonomy</Link>
          <Link href="/login" className={styles.navAuthBtn}>Operator</Link>
        </div>
      </nav>

      {/* ── Main Workspace ── */}
      <main className={styles.workspace}>
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.statusTicker}>
              <span className={styles.statusDot} />
              <span>LIVE QUEUE · 42 STATUTORY RAILS ACTIVE · TIMEZONE: IST</span>
            </div>
            <h1 className={styles.title}>Recovery Dossiers</h1>
            <p className={styles.subtitle}>
              Prioritized commercial receivables under active algorithmic tracking and Section 43B(h) statutory clock enforcement.
            </p>
          </div>

          {metrics && (
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricVal}>{metrics.open_cases}</span>
                <span className={styles.metricLbl}>ACTIVE CASES</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricVal} style={{ color: "var(--color-recovered)" }}>
                  {formatCurrency(metrics.recovered_amount_minor)}
                </span>
                <span className={styles.metricLbl}>FUNDS RECOVERED</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricVal} style={{ color: "var(--color-disallowed)" }}>
                  {metrics.msme_43b_h_at_risk_cases ?? 0}
                </span>
                <span className={styles.metricLbl}>43B(H) TAX AT RISK</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricVal} style={{ color: "var(--accent)" }}>
                  {formatCurrency(metrics.statutory_interest_minor ?? 0)}
                </span>
                <span className={styles.metricLbl}>3× PENAL ACCRUED</span>
              </div>
            </div>
          )}
        </header>

        {/* Unauthorized Banner */}
        {isUnauthorized && (
          <div className={styles.authNoticeBanner}>
            <div>
              <strong>Operator Session Required.</strong> Please sign in to view the live database queue and execute recovery actions.
            </div>
            <Link href="/login" className={styles.signInBtn}>
              Sign In to Console →
            </Link>
          </div>
        )}

        {/* General Error Banner */}
        {error && (
          <div className={styles.errorBanner}>
            Connection Notice: {error}
          </div>
        )}

        {/* Controls Bar */}
        <div className={styles.controlsBar}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Filter by invoice, buyer name, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterPills}>
            <button
              className={`${styles.filterPill} ${stateFilter === null ? styles.filterPillActive : ""}`}
              onClick={() => setStateFilter(null)}
            >
              All Cases ({items.length})
            </button>
            {ALL_STATES.filter((s) => items.some((i) => i.state === s)).map((s) => {
              const count = items.filter((i) => i.state === s).length;
              return (
                <button
                  key={s}
                  className={`${styles.filterPill} ${stateFilter === s ? styles.filterPillActive : ""}`}
                  onClick={() => setStateFilter(stateFilter === s ? null : s)}
                >
                  {STATE_LABELS[s]?.label ?? s} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.emptyState}>
            Initializing Dossier Telemetry...
          </div>
        )}

        {/* Empty State */}
        {!loading && !isUnauthorized && displayed.length === 0 && (
          <div className={styles.emptyState}>
            No recovery dossiers match the current filter.
          </div>
        )}

        {/* Table Ledger */}
        {!loading && displayed.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>INVOICE NUMBER</th>
                  <th>DEBTOR / GSTIN</th>
                  <th>RECOVERY STATE</th>
                  <th>RISK TIER</th>
                  <th>MSME 43B(H) STATUS</th>
                  <th
                    className={sortKey === "recovery_probability" ? styles.sortColActive : styles.sortCol}
                    onClick={() => toggleSort("recovery_probability")}
                  >
                    P(RECOVERY) {sortKey === "recovery_probability" ? (sortAsc ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className={sortKey === "amount_minor" ? styles.sortColActive : styles.sortCol}
                    onClick={() => toggleSort("amount_minor")}
                  >
                    PRINCIPAL {sortKey === "amount_minor" ? (sortAsc ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className={sortKey === "due_at" ? styles.sortColActive : styles.sortCol}
                    onClick={() => toggleSort("due_at")}
                  >
                    ORIGINAL DUE {sortKey === "due_at" ? (sortAsc ? "▲" : "▼") : ""}
                  </th>
                  <th>CONTACTS</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((item) => {
                  const stateCfg = STATE_LABELS[item.state] || {
                    label: item.state,
                    color: "var(--text-secondary)",
                    bg: "var(--bg-elevated)",
                  };
                  const probPct = item.recovery_probability != null ? Math.round(item.recovery_probability * 100) : null;
                  const probColor =
                    probPct != null
                      ? probPct >= 65
                        ? "var(--color-recovered)"
                        : probPct >= 40
                        ? "var(--color-warning)"
                        : "var(--color-disallowed)"
                      : "var(--text-muted)";

                  const stat = item.statutory_status;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/cases/${item.id}`)}
                      className={styles.tableRow}
                    >
                      <td>
                        <Link href={`/cases/${item.id}`} className={styles.invoiceLink}>
                          {item.invoice_number ?? item.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td>
                        <div className={styles.debtorCell}>
                          <div className={styles.debtorNameRow}>
                            <span className={styles.debtorName}>{item.customer_name ?? "Unknown Enterprise"}</span>
                            {item.customer_is_msme && (
                              <span className={styles.msmeTag}>
                                MSME {item.customer_msme_category ? `(${item.customer_msme_category[0]})` : ""}
                              </span>
                            )}
                          </div>
                          {item.customer_gstin && (
                            <span className={styles.debtorGstin}>{item.customer_gstin}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={styles.stateTag}
                          style={{ color: stateCfg.color, backgroundColor: stateCfg.bg }}
                        >
                          {stateCfg.label}
                        </span>
                      </td>
                      <td>
                        <span className={styles.riskTierTag}>
                          {item.credit_risk_tier ?? "TIER 2"}
                        </span>
                      </td>
                      <td>
                        {stat && stat.is_msme ? (
                          stat.is_disallowed ? (
                            <span className={styles.statDisallowed}>Disallowed</span>
                          ) : stat.days_remaining <= 5 ? (
                            <span className={styles.statUrgent}>{stat.days_remaining}d remaining</span>
                          ) : (
                            <span className={styles.statSafe}>{stat.days_remaining}d remaining</span>
                          )
                        ) : (
                          <span className={styles.statMuted}>Non-MSME</span>
                        )}
                      </td>
                      <td>
                        {probPct != null ? (
                          <div className={styles.probMeterWrap}>
                            <div className={styles.probTrack}>
                              <div
                                className={styles.probBar}
                                style={{ width: `${probPct}%`, backgroundColor: probColor }}
                              />
                            </div>
                            <span className={styles.probNum} style={{ color: probColor }}>
                              {probPct}%
                            </span>
                          </div>
                        ) : (
                          <span className={styles.statMuted}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.principalVal}>
                          {formatCurrency(item.amount_minor)}
                        </span>
                      </td>
                      <td>
                        <span className={styles.dueVal}>{formatDate(item.due_at)}</span>
                      </td>
                      <td>
                        <span className={styles.contactsVal}>
                          {item.contact_attempt_count ?? 0}/3
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
