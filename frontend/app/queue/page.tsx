"use client";

import { useEffect, useState, useMemo } from "react";
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

type UserProfile = {
  user_id: string;
  email: string;
  tenant_id: string;
  role: string;
};

const HUMAN_STATE_DESCRIPTIONS: Record<string, { label: string; actionHint: string; color: string; bg: string; border: string }> = {
  open: { label: "Ingested", actionHint: "Classifying gateway error", color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  classified: { label: "Diagnosed", actionHint: "Evaluating recovery policy", color: "var(--text-secondary)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  awaiting_action: { label: "Action Pending", actionHint: "Ready for payment reminder", color: "var(--status-pending)", bg: "rgba(196, 148, 58, 0.12)", border: "rgba(196, 148, 58, 0.3)" },
  contacted: { label: "Debtor Contacted", actionHint: "WhatsApp delivery sent", color: "var(--status-pending)", bg: "rgba(196, 148, 58, 0.12)", border: "rgba(196, 148, 58, 0.3)" },
  awaiting_response: { label: "Awaiting Reply", actionHint: "Waiting on customer commitment", color: "var(--status-pending)", bg: "rgba(196, 148, 58, 0.12)", border: "rgba(196, 148, 58, 0.3)" },
  promise_recorded: { label: "Promise Committed", actionHint: "Debtor scheduled payment", color: "var(--status-recovered)", bg: "rgba(34, 201, 151, 0.12)", border: "rgba(34, 201, 151, 0.3)" },
  human_review: { label: "Needs Operator Review", actionHint: "Dispute or manual escalation", color: "var(--status-warning)", bg: "rgba(138, 108, 196, 0.12)", border: "rgba(138, 108, 196, 0.3)" },
  paused: { label: "Temporarily Paused", actionHint: "Debtor requested grace period", color: "var(--text-muted)", bg: "var(--bg-elevated)", border: "var(--border-subtle)" },
  blocked: { label: "Compliance Blocked", actionHint: "Exceeded 3 contacts / 7d cap", color: "var(--status-disallowed)", bg: "rgba(232, 80, 80, 0.12)", border: "rgba(232, 80, 80, 0.3)" },
  recovered: { label: "Settled & Verified", actionHint: "Bank remittance matched", color: "var(--status-recovered)", bg: "rgba(34, 201, 151, 0.12)", border: "rgba(34, 201, 151, 0.3)" },
  unrecoverable: { label: "Marked Bad Debt", actionHint: "Exhausted statutory rails", color: "var(--status-disallowed)", bg: "rgba(232, 80, 80, 0.12)", border: "rgba(232, 80, 80, 0.3)" },
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

export default function QueuePage() {
  const router = useRouter();
  const [items, setItems] = useState<CaseRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("amount_minor");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    // Load current user profile
    apiFetch("/api/v1/auth/me")
      .then((u) => setUser(u))
      .catch(() => {});

    // Load active recovery queue
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

  // Filter and sort computation
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

  // Find the single highest-priority case needing immediate human attention
  const highestPriorityCase = useMemo(() => {
    return (
      items.find((c) => c.state === "human_review") ||
      items.find((c) => c.statutory_status?.days_remaining != null && c.statutory_status.days_remaining <= 5 && !c.statutory_status.is_disallowed) ||
      items[0]
    );
  }, [items]);

  return (
    <div className={styles.ledgerShell}>
      {/* ── Top Executive Navigation ── */}
      <nav className={styles.topBar}>
        <div className={styles.barLeft}>
          <Link href="/" className={styles.brandMark}>
            <span>VAADA</span>
            <span className={styles.brandDevanagari}>वादा</span>
          </Link>
          <span className={styles.barDivider}>/</span>
          <span className={styles.barTitle}>Operations Console</span>
        </div>

        <div className={styles.barRight}>
          <Link href="/analytics" className={styles.barNavLink}>Portfolio Analytics</Link>
          <Link href="/audit" className={styles.barNavLink}>Audit Log</Link>
          <Link href="/settings" className={styles.barNavLink}>Compliance Rules</Link>
          <Link href="/razorpay-taxonomy" className={styles.barNavLink}>Gateway Taxonomy</Link>
          
          {user ? (
            <div className={styles.userProfilePill}>
              <span className={styles.userDot} />
              <span className={styles.userEmail}>{user.email}</span>
              <span className={styles.userRoleTag}>{user.role}</span>
            </div>
          ) : (
            <Link href="/login" className={styles.signInLink}>Sign In</Link>
          )}
        </div>
      </nav>

      {/* ── Main Executive Workspace ── */}
      <main className={styles.workspace}>
        {/* Header Strip */}
        <header className={styles.header}>
          <div>
            <h1 className={styles.pageHeadline}>Commercial Receivables</h1>
            <p className={styles.pageSubheadline}>
              Prioritized invoices under automated surveillance, debtor communication, and Section 43B(h) compliance.
            </p>
          </div>

          {/* Portfolio Health Summary Strip */}
          {metrics && (
            <div className={styles.metricsSummaryStrip}>
              <div className={styles.metricItem}>
                <span className={styles.mLabel}>PORTFOLIO VALUE</span>
                <span className={styles.mValue}>
                  {formatCurrency(items.reduce((sum, item) => sum + (item.amount_minor || 0), 0))}
                </span>
                <span className={styles.mMeta}>{items.length} active invoices</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.mLabel}>CASH SETTLED</span>
                <span className={styles.mValue} style={{ color: "var(--color-recovered)" }}>
                  {formatCurrency(metrics.recovered_amount_minor)}
                </span>
                <span className={styles.mMeta}>{metrics.recovered_cases} verified payments</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.mLabel}>DISALLOWANCE RISK</span>
                <span className={styles.mValue} style={{ color: "var(--color-disallowed)" }}>
                  {metrics.msme_43b_h_at_risk_cases ?? 0} Debtors
                </span>
                <span className={styles.mMeta}>MSME 45-day cutoff</span>
              </div>

              <div className={styles.metricItem}>
                <span className={styles.mLabel}>3× PENAL ACCRUED</span>
                <span className={styles.mValue} style={{ color: "var(--accent)" }}>
                  {formatCurrency(metrics.statutory_interest_minor ?? 0)}
                </span>
                <span className={styles.mMeta}>MSMED Act claimable</span>
              </div>
            </div>
          )}
        </header>

        {/* Highest Priority Attention Banner */}
        {highestPriorityCase && (
          <div className={styles.attentionBanner}>
            <div className={styles.attnLeft}>
              <span className={styles.attnTag}>RECOMMENDED OPERATOR FOCUS</span>
              <h3 className={styles.attnTitle}>
                {highestPriorityCase.customer_name} — {highestPriorityCase.invoice_number} ({formatCurrency(highestPriorityCase.amount_minor)})
              </h3>
              <p className={styles.attnDetail}>
                {highestPriorityCase.state === "human_review"
                  ? "Requires human adjudication: Debtor raised payment terms query or disputed invoice."
                  : highestPriorityCase.statutory_status?.days_remaining != null && highestPriorityCase.statutory_status.days_remaining <= 5
                  ? `Critical Section 43B(h) deadline: ${highestPriorityCase.statutory_status.days_remaining} days left before debtor incurs 31.2% corporate tax disallowance.`
                  : "Active promise scheduled on WhatsApp. Ready for automated reminder verification."}
              </p>
            </div>
            <Link href={`/cases/${highestPriorityCase.id}`} className={styles.attnActionBtn}>
              Inspect Dossier →
            </Link>
          </div>
        )}

        {/* Unauthorized Notification */}
        {isUnauthorized && (
          <div className={styles.authNotice}>
            <div>
              <strong>Operator session required.</strong> Sign in with demo credentials to access live case records and trigger recovery actions.
            </div>
            <Link href="/login" className={styles.authSignInBtn}>Sign In Now →</Link>
          </div>
        )}

        {/* Error Notification */}
        {error && <div className={styles.errorNotice}>Notice: {error}</div>}

        {/* Controls: Search, Filters, and Sorters */}
        <div className={styles.controlsRow}>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Search by enterprise buyer, invoice, or GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterPills}>
            <button
              className={`${styles.filterPill} ${stateFilter === null ? styles.pillActive : ""}`}
              onClick={() => setStateFilter(null)}
            >
              All Invoices ({items.length})
            </button>
            <button
              className={`${styles.filterPill} ${stateFilter === "awaiting_action" ? styles.pillActive : ""}`}
              onClick={() => setStateFilter(stateFilter === "awaiting_action" ? null : "awaiting_action")}
            >
              Action Pending ({items.filter((i) => i.state === "awaiting_action").length})
            </button>
            <button
              className={`${styles.filterPill} ${stateFilter === "promise_recorded" ? styles.pillActive : ""}`}
              onClick={() => setStateFilter(stateFilter === "promise_recorded" ? null : "promise_recorded")}
            >
              Promises Committed ({items.filter((i) => i.state === "promise_recorded").length})
            </button>
            <button
              className={`${styles.filterPill} ${stateFilter === "human_review" ? styles.pillActive : ""}`}
              onClick={() => setStateFilter(stateFilter === "human_review" ? null : "human_review")}
            >
              Needs Review ({items.filter((i) => i.state === "human_review").length})
            </button>
            <button
              className={`${styles.filterPill} ${stateFilter === "recovered" ? styles.pillActive : ""}`}
              onClick={() => setStateFilter(stateFilter === "recovered" ? null : "recovered")}
            >
              Settled ({items.filter((i) => i.state === "recovered").length})
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loadingBox}>
            Synchronizing portfolio ledger with database...
          </div>
        )}

        {/* Empty State */}
        {!loading && filtered.length === 0 && (
          <div className={styles.emptyBox}>
            No receivables match the active filter criteria.
          </div>
        )}

        {/* Data-Dense Executive Ledger */}
        {!loading && filtered.length > 0 && (
          <div className={styles.tableContainer}>
            <table className={styles.ledgerTable}>
              <thead>
                <tr>
                  <th>INVOICE</th>
                  <th>ENTERPRISE BUYER</th>
                  <th>RECOVERY STATUS</th>
                  <th>SECTION 43B(H) CLOCK</th>
                  <th
                    className={sortKey === "recovery_probability" ? styles.sortColActive : styles.sortCol}
                    onClick={() => toggleSort("recovery_probability")}
                  >
                    ESTIMATED RECOVERY {sortKey === "recovery_probability" ? (sortAsc ? "▲" : "▼") : ""}
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
                    DUE DATE {sortKey === "due_at" ? (sortAsc ? "▲" : "▼") : ""}
                  </th>
                  <th>CONTACTS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const stateMeta = HUMAN_STATE_DESCRIPTIONS[item.state] || {
                    label: item.state,
                    actionHint: "In progress",
                    color: "var(--text-secondary)",
                    bg: "var(--bg-elevated)",
                  };

                  const probPct = item.recovery_probability != null ? Math.round(item.recovery_probability * 100) : null;
                  const probColor =
                    probPct != null
                      ? probPct >= 65
                        ? "var(--status-recovered)"
                        : probPct >= 40
                        ? "var(--status-pending)"
                        : "var(--status-disallowed)"
                      : "var(--text-muted)";

                  const stat = item.statutory_status;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => router.push(`/cases/${item.id}`)}
                      className={styles.ledgerRow}
                    >
                      {/* Invoice Link */}
                      <td className={styles.invoiceCell}>
                        <Link href={`/cases/${item.id}`} className={styles.invoiceNumber}>
                          {item.invoice_number ?? item.id.slice(0, 8)}
                        </Link>
                      </td>

                      {/* Debtor & GSTIN */}
                      <td>
                        <div className={styles.debtorInfo}>
                          <div className={styles.debtorNameRow}>
                            <span className={styles.debtorTitle}>{item.customer_name ?? "Unknown Enterprise"}</span>
                            {item.customer_is_msme && (
                              <span className={styles.msmeTag}>
                                MSME ({item.customer_msme_category ?? "Small"})
                              </span>
                            )}
                          </div>
                          <span className={styles.debtorGstin}>{item.customer_gstin ?? "Unregistered Buyer"}</span>
                        </div>
                      </td>

                      {/* Human Status & Action Hint */}
                      <td>
                        <div className={styles.statusCell}>
                          <span
                            className={styles.statusBadge}
                            style={{
                              color: stateMeta.color,
                              backgroundColor: stateMeta.bg,
                              border: `1px solid ${stateMeta.border || "transparent"}`,
                            }}
                          >
                            {stateMeta.label}
                          </span>
                          <span className={styles.statusActionHint}>{stateMeta.actionHint}</span>
                        </div>
                      </td>

                      {/* Statutory Section 43B(h) Status */}
                      <td>
                        {stat && stat.is_msme ? (
                          stat.is_disallowed ? (
                            <span className={styles.clockDisallowed}>Disallowed (Tax Penalty)</span>
                          ) : stat.days_remaining <= 5 ? (
                            <span className={styles.clockUrgent}>{stat.days_remaining}d remaining</span>
                          ) : (
                            <span className={styles.clockSafe}>{stat.days_remaining}d remaining</span>
                          )
                        ) : (
                          <span className={styles.clockNonMsme}>Non-MSME</span>
                        )}
                      </td>

                      {/* Recovery Likelihood Meter */}
                      <td>
                        {probPct != null ? (
                          <div className={styles.likelihoodWrap}>
                            <div className={styles.likelihoodTrack}>
                              <div
                                className={styles.likelihoodFill}
                                style={{ width: `${probPct}%`, backgroundColor: probColor }}
                              />
                            </div>
                            <span className={styles.likelihoodNum} style={{ color: probColor }}>
                              {probPct}%
                            </span>
                          </div>
                        ) : (
                          <span className={styles.clockNonMsme}>—</span>
                        )}
                      </td>

                      {/* Principal Amount */}
                      <td>
                        <span className={styles.principalNumber}>
                          {formatCurrency(item.amount_minor)}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td>
                        <span className={styles.dateNumber}>{formatDate(item.due_at)}</span>
                      </td>

                      {/* Rolling Contacts Cap */}
                      <td>
                        <span className={styles.contactsCounter}>
                          {item.contact_attempt_count ?? 0} / 3
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
