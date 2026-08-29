"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import gsap from "gsap";
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

const STATE_LABELS: Record<string, string> = {
  open: "OPEN",
  classified: "CLASSIFIED",
  awaiting_action: "AWAITING ACTION",
  contacted: "CONTACTED",
  awaiting_response: "AWAITING REPLY",
  promise_recorded: "PROMISE RECORDED",
  human_review: "HUMAN REVIEW",
  paused: "PAUSED",
  blocked: "BLOCKED",
  recovered: "RECOVERED",
  unrecoverable: "UNRECOVERABLE",
  cancelled: "CANCELLED",
};

const CAUSE_LABELS: Record<string, string> = {
  insufficient_funds: "Insufficient funds",
  mandate_failed: "Mandate failed",
  bank_decline: "Bank decline",
  network_error: "Network error",
  customer_dispute: "Customer dispute",
  invoice_mismatch: "Invoice mismatch",
  card_expired: "Card expired",
  unstructured_text: "Unstructured",
  unknown: "Unknown",
};

const ALL_STATES = [
  "awaiting_action", "awaiting_response", "promise_recorded",
  "human_review", "paused", "blocked", "recovered", "unrecoverable",
];

function StateBadge({ state }: { state: string }) {
  return (
    <span className={`${styles.badge} ${styles[state] || ""}`}>
      <span className={styles.badgeDot} />
      {STATE_LABELS[state] ?? state.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

function RiskBadge({ tier }: { tier?: string }) {
  const t = tier || "MEDIUM";
  return <span className={`${styles.riskTier} ${styles[t] || ""}`}>{t}</span>;
}

function StatutoryChip({ stat }: { stat?: CaseRow["statutory_status"] }) {
  if (!stat || !stat.is_msme) return <span className={styles.cause}>—</span>;
  if (stat.is_disallowed) {
    return <span className={`${styles.countdownChip} ${styles.disallowed}`}>⚠️ 43B(h) Disallowed</span>;
  }
  if (stat.days_remaining <= 5) {
    return <span className={`${styles.countdownChip} ${styles.urgent}`}>🔥 43B(h): {stat.days_remaining}d left</span>;
  }
  return <span className={`${styles.countdownChip} ${styles.safe}`}>⏱️ {stat.days_remaining}d left</span>;
}

function ProbBar({ prob }: { prob: number | null }) {
  if (prob === null) return <span className={styles.cause}>—</span>;
  const pct = Math.round(prob * 100);
  const cls = pct >= 60 ? styles.high : pct >= 35 ? styles.med : styles.low;
  return (
    <div className={styles.probWrap}>
      <div className={styles.probBar}>
        <div className={`${styles.probFill} ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.probText}>{pct}%</span>
    </div>
  );
}

function AnimatedAmount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const obj = useRef({ v: 0 });
  useEffect(() => {
    gsap.to(obj.current, {
      v: value / 100,
      duration: 1.4,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = "₹" + Math.round(obj.current.v).toLocaleString("en-IN");
        }
      },
    });
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
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortAsc, setSortAsc] = useState(false);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    apiFetch("/api/v1/cases?limit=50")
      .then((data) => {
        setItems(data.items ?? []);
        if (data.metrics) setMetrics(data.metrics);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Stagger animate rows on load
  useEffect(() => {
    if (!loading && tableRef.current) {
      const rows = tableRef.current.querySelectorAll("tr");
      gsap.from(rows, {
        x: -20,
        opacity: 0,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.04,
      });
    }
  }, [loading]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  let displayed = stateFilter ? items.filter((i) => i.state === stateFilter) : items;
  if (sortKey) {
    displayed = [...displayed].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortAsc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.navMark}>VAAYDA / OPS CONSOLE</span>
        <div className={styles.navLinks}>
          <Link href="/">Public site</Link>
          <Link href="/audit">Audit trail</Link>
          <Link href="/settings">Compliance config</Link>
        </div>
      </nav>

      <div className={styles.header}>
        <div>
          <p className={styles.headerLabel}>Live queue • India B2B</p>
          <h1 className={styles.headerTitle}>Recovery cases</h1>
        </div>
        <div />
        {metrics && (
          <div className={styles.metrics}>
            <div className={styles.metric}>
              <span className={styles.metricValue}>{metrics.open_cases}</span>
              <span className={styles.metricLabel}>Open cases</span>
            </div>
            <div className={styles.metric}>
              <span className={`${styles.metricValue} ${styles.accent}`}>
                <AnimatedAmount value={metrics.recovered_amount_minor} />
              </span>
              <span className={styles.metricLabel}>Recovered</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue} style={{ color: "#d24a16" }}>
                {metrics.msme_43b_h_at_risk_cases ?? 0}
              </span>
              <span className={styles.metricLabel}>43B(h) At Risk</span>
            </div>
            <div className={styles.metric}>
              <span className={styles.metricValue} style={{ color: "#e09020" }}>
                <AnimatedAmount value={metrics.statutory_interest_minor ?? 0} />
              </span>
              <span className={styles.metricLabel}>3x Penal Interest</span>
            </div>
          </div>
        )}
      </div>

      {/* Filter chips */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter:</span>
        <button
          className={`${styles.filterChip} ${stateFilter === null ? styles.active : ""}`}
          onClick={() => setStateFilter(null)}
        >
          All ({items.length})
        </button>
        {ALL_STATES.filter((s) => items.some((i) => i.state === s)).map((s) => (
          <button
            key={s}
            className={`${styles.filterChip} ${stateFilter === s ? styles.active : ""}`}
            onClick={() => setStateFilter(stateFilter === s ? null : s)}
          >
            {STATE_LABELS[s] ?? s} ({items.filter((i) => i.state === s).length})
          </button>
        ))}
      </div>

      {loading && <p className={styles.statusRow}>FETCHING RECOVERY QUEUE…</p>}
      {error && <p className={styles.errorRow}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className={styles.statusRow}>No recovery cases. Seed the database to populate the queue.</p>
      )}

      {!loading && displayed.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer / GSTIN</th>
                <th>State</th>
                <th>Risk Tier</th>
                <th>MSME 43B(h) Status</th>
                <th
                  className={sortKey === "recovery_probability" ? styles.sorted : ""}
                  onClick={() => toggleSort("recovery_probability")}
                >
                  P(recovery) {sortKey === "recovery_probability" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  className={sortKey === "amount_minor" ? styles.sorted : ""}
                  onClick={() => toggleSort("amount_minor")}
                >
                  Amount {sortKey === "amount_minor" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th
                  className={sortKey === "due_at" ? styles.sorted : ""}
                  onClick={() => toggleSort("due_at")}
                >
                  Due {sortKey === "due_at" ? (sortAsc ? "↑" : "↓") : "↕"}
                </th>
                <th>Contacts</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {displayed.map((item) => (
                <tr key={item.id} onClick={() => { window.location.href = `/cases/${item.id}`; }}>
                  <td>
                    <Link className={styles.invoiceLink} href={`/cases/${item.id}`}>
                      {item.invoice_number ?? item.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>
                    <span className={styles.customer}>
                      {item.customer_name ?? "—"}
                      {item.customer_is_msme && (
                        <span className={styles.msmeTag}>
                          MSME {item.customer_msme_category ? `(${item.customer_msme_category[0]})` : ""}
                        </span>
                      )}
                    </span>
                    {item.customer_gstin && (
                      <span className={styles.customerGstin}>{item.customer_gstin}</span>
                    )}
                  </td>
                  <td><StateBadge state={item.state} /></td>
                  <td><RiskBadge tier={item.credit_risk_tier} /></td>
                  <td><StatutoryChip stat={item.statutory_status} /></td>
                  <td><ProbBar prob={item.recovery_probability} /></td>
                  <td>
                    <span className={styles.amount}>
                      {item.amount_minor != null
                        ? `₹${(item.amount_minor / 100).toLocaleString("en-IN")}`
                        : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cause}>
                      {item.due_at
                        ? new Date(item.due_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                        : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={styles.cause}>{item.contact_attempt_count ?? 0}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

