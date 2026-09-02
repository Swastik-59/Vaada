"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { motion, animate } from "motion/react";
import styles from "./queue.module.css";

// ── Types ──
type CaseRow = any; // Simplifying for the rewrite
type Metrics = any;

const STATE_LABELS: Record<string, string> = {
  open: "Open",
  classified: "Classified",
  awaiting_action: "Awaiting Action",
  contacted: "Contacted",
  awaiting_response: "Awaiting Reply",
  promise_recorded: "Promise Recorded",
  human_review: "Human Review",
  paused: "Paused",
  blocked: "Blocked",
  recovered: "Recovered",
  unrecoverable: "Unrecoverable",
  cancelled: "Cancelled",
};

const ALL_STATES = [
  "awaiting_action",
  "awaiting_response",
  "promise_recorded",
  "human_review",
  "recovered",
  "unrecoverable",
];

function formatCurrency(val: number) {
  return "₹" + (val / 100).toLocaleString("en-IN");
}

export default function QueuePage() {
  const [items, setItems] = useState<CaseRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/cases?limit=50")
      .then((data) => {
        setItems(data.items ?? []);
        if (data.metrics) setMetrics(data.metrics);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  return (
    <div className={styles.shell}>
      {/* Top Nav */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.navMark}>Vaada.</Link>
          <span className={styles.navSlash}>/</span>
          <span className={styles.navSectionTitle}>Operations Console</span>
        </div>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>Public Machine</Link>
          <Link href="/audit" className={styles.navLink}>Audit Trail</Link>
          <Link href="/settings" className={styles.navLink}>Compliance</Link>
          <Link href="/razorpay-taxonomy" className={styles.navLink}>Taxonomy</Link>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className={styles.workspace}>
        <header className={styles.telemetryHeader}>
          <div className={styles.titleColumn}>
            <h1 className={styles.pageTitle}>Recovery Dossiers</h1>
            <p className={styles.pageSubtitle}>
              Prioritized receivables under algorithmic tracking.
            </p>
          </div>

          {metrics && (
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{metrics.open_cases}</span>
                <span className={styles.metricLabel}>Active Cases</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricRecovered}`}>
                <span className={styles.metricValue}>
                  {formatCurrency(metrics.recovered_amount_minor)}
                </span>
                <span className={styles.metricLabel}>Funds Recovered</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricWarning}`}>
                <span className={styles.metricValue}>{metrics.msme_43b_h_at_risk_cases ?? 0}</span>
                <span className={styles.metricLabel}>43B(H) At Risk</span>
              </div>
            </div>
          )}
        </header>

        {/* Control Bar */}
        <div className={styles.controlBar}>
          <input
            type="text"
            placeholder="Search invoice, buyer, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
          <div className={styles.filterPills}>
            <button
              className={`${styles.filterPill} ${stateFilter === null ? styles.filterPillActive : ""}`}
              onClick={() => setStateFilter(null)}
            >
              All
            </button>
            {ALL_STATES.filter((s) => items.some((i) => i.state === s)).map((s) => (
              <button
                key={s}
                className={`${styles.filterPill} ${stateFilter === s ? styles.filterPillActive : ""}`}
                onClick={() => setStateFilter(stateFilter === s ? null : s)}
              >
                {STATE_LABELS[s] || s}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {loading && <div className={styles.feedbackRow}>Loading Queue...</div>}
        {error && <div className={styles.feedbackRow}>Error: {error}</div>}
        {!loading && !error && displayed.length === 0 && (
          <div className={styles.emptyRow}>No cases found.</div>
        )}

        {/* Table */}
        {!loading && displayed.length > 0 && (
          <div className={styles.tableContainer}>
            <table className={styles.dossierTable}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Buyer</th>
                  <th>State</th>
                  <th>Risk</th>
                  <th>43B(H) Days Left</th>
                  <th>P(Rec)</th>
                  <th>Principal</th>
                </tr>
              </thead>
              <motion.tbody
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.03 } } }}
              >
                {displayed.map((item) => (
                  <motion.tr
                    key={item.id}
                    onClick={() => { window.location.href = `/cases/${item.id}`; }}
                    variants={{
                      hidden: { opacity: 0, y: 10 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
                    }}
                    className={styles.tableRow}
                  >
                    <td>
                      <Link href={`/cases/${item.id}`} className={styles.invoiceNumberLink}>
                        {item.invoice_number ?? item.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td>
                      <div className={styles.buyerCell}>
                        <span className={styles.buyerName}>{item.customer_name ?? "Unknown Enterprise"}</span>
                        {item.customer_gstin && <span className={styles.buyerGstin}>{item.customer_gstin}</span>}
                      </div>
                    </td>
                    <td>
                      <span className={styles.stateBadge}>{STATE_LABELS[item.state] || item.state}</span>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {item.credit_risk_tier ?? "MEDIUM"}
                    </td>
                    <td style={{ color: item.statutory_status?.is_disallowed ? "var(--color-disallowed)" : "var(--text-secondary)" }}>
                      {item.statutory_status?.is_msme 
                        ? (item.statutory_status.is_disallowed ? "Disallowed" : item.statutory_status.days_remaining) 
                        : "—"}
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {item.recovery_probability ? Math.round(item.recovery_probability * 100) + "%" : "—"}
                    </td>
                    <td>
                      <div className={styles.amountValue}>
                        {item.amount_minor != null ? formatCurrency(item.amount_minor) : "—"}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
