"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { motion, animate } from "motion/react";
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

const STATE_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  open: { label: "OPEN", color: "var(--text-muted)", border: "var(--border-strong)", bg: "transparent" },
  classified: { label: "CLASSIFIED", color: "var(--text-secondary)", border: "var(--border-strong)", bg: "transparent" },
  awaiting_action: { label: "AWAITING ACTION", color: "#38bdf8", border: "rgba(56, 189, 248, 0.4)", bg: "rgba(56, 189, 248, 0.08)" },
  contacted: { label: "CONTACTED", color: "#d4973b", border: "rgba(212, 151, 59, 0.4)", bg: "rgba(212, 151, 59, 0.08)" },
  awaiting_response: { label: "AWAITING REPLY", color: "#d4973b", border: "rgba(212, 151, 59, 0.4)", bg: "rgba(212, 151, 59, 0.08)" },
  promise_recorded: { label: "PROMISE RECORDED", color: "#4ade80", border: "rgba(74, 222, 128, 0.4)", bg: "rgba(74, 222, 128, 0.08)" },
  human_review: { label: "HUMAN REVIEW", color: "var(--accent)", border: "rgba(216, 80, 36, 0.5)", bg: "rgba(216, 80, 36, 0.1)" },
  paused: { label: "PAUSED", color: "var(--text-muted)", border: "var(--border-strong)", bg: "transparent" },
  blocked: { label: "BLOCKED", color: "#f87171", border: "rgba(248, 113, 113, 0.4)", bg: "rgba(248, 113, 113, 0.08)" },
  recovered: { label: "RECOVERED", color: "#27744b", border: "rgba(39, 116, 75, 0.5)", bg: "rgba(39, 116, 75, 0.12)" },
  unrecoverable: { label: "UNRECOVERABLE", color: "#c02020", border: "rgba(192, 32, 32, 0.4)", bg: "rgba(192, 32, 32, 0.08)" },
  cancelled: { label: "CANCELLED", color: "var(--text-muted)", border: "var(--border-subtle)", bg: "transparent" },
};

const ALL_STATES = [
  "awaiting_action",
  "awaiting_response",
  "promise_recorded",
  "human_review",
  "paused",
  "blocked",
  "recovered",
  "unrecoverable",
];

function StateBadge({ state }: { state: string }) {
  const cfg = STATE_CONFIG[state] || {
    label: state.replace(/_/g, " ").toUpperCase(),
    color: "var(--text-muted)",
    border: "var(--border-strong)",
    bg: "transparent",
  };
  return (
    <span
      className={styles.stateBadge}
      style={{
        color: cfg.color,
        borderColor: cfg.border,
        backgroundColor: cfg.bg,
      }}
    >
      <span className={styles.stateBadgeDot} style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}

function RiskBadge({ tier }: { tier?: string }) {
  const t = tier || "MEDIUM";
  const colors: Record<string, { color: string; bg: string }> = {
    LOW: { color: "#4ade80", bg: "rgba(74, 222, 128, 0.1)" },
    MEDIUM: { color: "#d4973b", bg: "rgba(212, 151, 59, 0.1)" },
    HIGH: { color: "#d85024", bg: "rgba(216, 80, 36, 0.15)" },
    CRITICAL: { color: "#f87171", bg: "rgba(248, 113, 113, 0.2)" },
  };
  const c = colors[t] || colors.MEDIUM;
  return (
    <span className={styles.riskBadge} style={{ color: c.color, backgroundColor: c.bg }}>
      {t}
    </span>
  );
}

function StatutoryMeter({ stat }: { stat?: CaseRow["statutory_status"] }) {
  if (!stat || !stat.is_msme) return <span className={styles.mutedText}>—</span>;
  if (stat.is_disallowed) {
    return <span className={`${styles.statutoryChip} ${styles.statutoryDisallowed}`}>⚠️ 43B(h) Disallowed</span>;
  }
  if (stat.days_remaining <= 5) {
    return <span className={`${styles.statutoryChip} ${styles.statutoryUrgent}`}>🔥 43B(h): {stat.days_remaining}d left</span>;
  }
  return <span className={`${styles.statutoryChip} ${styles.statutorySafe}`}>⏱️ 43B(h): {stat.days_remaining}d left</span>;
}

function ProbabilityGauge({ prob }: { prob: number | null }) {
  if (prob === null) return <span className={styles.mutedText}>—</span>;
  const pct = Math.round(prob * 100);
  const color = pct >= 65 ? "var(--color-recovered)" : pct >= 40 ? "var(--color-warning)" : "var(--color-disallowed)";
  return (
    <div className={styles.gaugeWrap}>
      <div className={styles.gaugeBar}>
        <div className={styles.gaugeFill} style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className={styles.gaugeVal} style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

function AnimatedCurrency({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const controls = animate(0, value / 100, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current) {
          ref.current.textContent = "₹" + Math.round(v).toLocaleString("en-IN");
        }
      },
    });
    return controls.stop;
  }, [value]);
  return <span ref={ref}>₹0</span>;
}

type SortKey = "amount_minor" | "recovery_probability" | "due_at" | "statutory_interest_minor" | null;

export default function QueuePage() {
  const [items, setItems] = useState<CaseRow[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
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
      .catch((err) => setError(err.message))
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

  // Filter items
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
      {/* Top Console Navigation */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.navMark}>
            VAADA <span className={styles.navDevanagari}>वादा</span>
          </Link>
          <span className={styles.navSlash}>/</span>
          <span className={styles.navSectionTitle}>OPERATIONS CONSOLE</span>
        </div>
        <div className={styles.navLinks}>
          <Link href="/" className={styles.navLink}>
            Public Machine
          </Link>
          <Link href="/audit" className={styles.navLink}>
            Audit Trail
          </Link>
          <Link href="/settings" className={styles.navLink}>
            Compliance Config
          </Link>
          <Link href="/razorpay-taxonomy" className={styles.navLink}>
            Error Intelligence
          </Link>
        </div>
      </nav>

      {/* Main Workspace */}
      <div className={styles.workspace}>
        {/* Telemetry Header */}
        <header className={styles.telemetryHeader}>
          <div className={styles.titleColumn}>
            <div className={styles.statusTicker}>
              <span className={styles.pulseDot} />
              <span>LIVE QUEUE · 42/42 STATUTORY RAILS ACTIVE · TIMEZONE: IST (08:00–19:00)</span>
            </div>
            <h1 className={styles.pageTitle}>Recovery Dossiers</h1>
            <p className={styles.pageSubtitle}>
              Prioritized receivables under active algorithmic tracking and statutory protection.
            </p>
          </div>

          {metrics && (
            <div className={styles.metricsGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>{metrics.open_cases}</span>
                <span className={styles.metricLabel}>ACTIVE CASES</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricRecovered}`}>
                <span className={styles.metricValue}>
                  <AnimatedCurrency value={metrics.recovered_amount_minor} />
                </span>
                <span className={styles.metricLabel}>FUNDS RECOVERED</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricDisallowed}`}>
                <span className={styles.metricValue}>{metrics.msme_43b_h_at_risk_cases ?? 0}</span>
                <span className={styles.metricLabel}>43B(H) TAX AT RISK</span>
              </div>
              <div className={`${styles.metricCard} ${styles.metricWarning}`}>
                <span className={styles.metricValue}>
                  <AnimatedCurrency value={metrics.statutory_interest_minor ?? 0} />
                </span>
                <span className={styles.metricLabel}>3× PENAL ACCRUED</span>
              </div>
            </div>
          )}
        </header>

        {/* Filter and Search Bar */}
        <div className={styles.controlBar}>
          <div className={styles.searchWrap}>
            <input
              type="text"
              placeholder="Search invoice number, buyer name, or GSTIN..."
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
              ALL CASES ({items.length})
            </button>
            {ALL_STATES.filter((s) => items.some((i) => i.state === s)).map((s) => {
              const count = items.filter((i) => i.state === s).length;
              return (
                <button
                  key={s}
                  className={`${styles.filterPill} ${stateFilter === s ? styles.filterPillActive : ""}`}
                  onClick={() => setStateFilter(stateFilter === s ? null : s)}
                >
                  {STATE_CONFIG[s]?.label ?? s.replace(/_/g, " ").toUpperCase()} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading and Error Feedback */}
        {loading && (
          <div className={styles.feedbackRow}>
            <div className={styles.spinner} />
            <span>CALIBRATING RECOVERY QUEUE TELEMETRY…</span>
          </div>
        )}

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️ API ERROR: {error}</span>
          </div>
        )}

        {!loading && !error && displayed.length === 0 && (
          <div className={styles.emptyRow}>
            <span>NO RECOVERY CASES FOUND MATCHING CURRENT FILTER</span>
          </div>
        )}

        {/* High-Density Case Ledger Table */}
        {!loading && displayed.length > 0 && (
          <div className={styles.tableContainer}>
            <table className={styles.dossierTable}>
              <thead>
                <tr>
                  <th>INVOICE NUMBER</th>
                  <th>DEBTOR / GSTIN</th>
                  <th>RECOVERY STATE</th>
                  <th>CREDIT RISK</th>
                  <th>MSME 43B(H) STATUS</th>
                  <th
                    className={sortKey === "recovery_probability" ? styles.sortActive : ""}
                    onClick={() => toggleSort("recovery_probability")}
                  >
                    P(RECOVERY) {sortKey === "recovery_probability" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th
                    className={sortKey === "amount_minor" ? styles.sortActive : ""}
                    onClick={() => toggleSort("amount_minor")}
                  >
                    PRINCIPAL {sortKey === "amount_minor" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th
                    className={sortKey === "due_at" ? styles.sortActive : ""}
                    onClick={() => toggleSort("due_at")}
                  >
                    ORIGINAL DUE {sortKey === "due_at" ? (sortAsc ? "↑" : "↓") : "↕"}
                  </th>
                  <th>CONTACTS</th>
                </tr>
              </thead>
              <motion.tbody
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.03 } },
                }}
              >
                {displayed.map((item) => (
                  <motion.tr
                    key={item.id}
                    onClick={() => {
                      window.location.href = `/cases/${item.id}`;
                    }}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
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
                        {item.customer_is_msme && (
                          <span className={styles.msmeTag}>
                            MSME {item.customer_msme_category ? `(${item.customer_msme_category[0]})` : ""}
                          </span>
                        )}
                      </div>
                      {item.customer_gstin && (
                        <div className={styles.buyerGstin}>{item.customer_gstin}</div>
                      )}
                    </td>
                    <td>
                      <StateBadge state={item.state} />
                    </td>
                    <td>
                      <RiskBadge tier={item.credit_risk_tier} />
                    </td>
                    <td>
                      <StatutoryMeter stat={item.statutory_status} />
                    </td>
                    <td>
                      <ProbabilityGauge prob={item.recovery_probability} />
                    </td>
                    <td>
                      <div className={styles.amountValue}>
                        {item.amount_minor != null
                          ? `₹${(item.amount_minor / 100).toLocaleString("en-IN")}`
                          : "—"}
                      </div>
                    </td>
                    <td>
                      <span className={styles.dueText}>
                        {item.due_at
                          ? new Date(item.due_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.contactsCount}>{item.contact_attempt_count ?? 0}</span>
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
