"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import styles from "./audit.module.css";

type AuditEvent = {
  id: string;
  action: string;
  actor_type: string;
  actor_id: string | null;
  resource_type: string;
  resource_id: string | null;
  correlation_id: string | null;
  payload_json: string;
  created_at: string | null;
};

const ACTION_PREFIXES = [
  { label: "All Activity", value: "" },
  { label: "Case Transitions", value: "case." },
  { label: "Payment Ingestion", value: "event." },
  { label: "Operator Security", value: "auth." },
];

const HUMAN_ACTION_MAP: Record<string, string> = {
  "case.transitioned": "Case State Transitioned",
  "case.outbound_sent": "Debtor WhatsApp Reminder Dispatched",
  "case.notice_generated": "Statutory Legal Notice Served",
  "case.reconciled_tds": "Section 194C/J TDS Reconciled",
  "case.reconciled_payment": "Bank Remittance Matched",
  "case.human_override": "Operator Adjudication Applied",
  "case.p2p_recorded": "Debtor Promise-to-Pay Recorded",
  "event.ingested": "Payment Failure Event Ingested",
  "auth.login_succeeded": "Operator Authentication Succeeded",
  "auth.login_failed": "Authentication Attempt Rejected",
  "auth.logout": "Operator Session Terminated",
  "auth.refresh": "Session Token Rotated",
};

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function exportCsv(items: AuditEvent[]) {
  const header = "timestamp,human_action,raw_action,actor_type,actor_id,resource_type,resource_id,correlation_id";
  const rows = items.map((i) =>
    [
      i.created_at ?? "",
      HUMAN_ACTION_MAP[i.action] || i.action,
      i.action,
      i.actor_type,
      i.actor_id ?? "",
      i.resource_type,
      i.resource_id ?? "",
      i.correlation_id ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vaada-audit-trail-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [prefix, setPrefix] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/v1/audit?limit=200&action_prefix=${encodeURIComponent(prefix)}`)
      .then((data) => setItems(data.items ?? []))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          setIsUnauthorized(true);
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [prefix]);

  return (
    <div className={styles.shell}>
      {/* Top Console Navigation */}
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/queue" className={styles.navBrand}>
            <span>VAADA</span>
            <span className={styles.navDevanagari}>वादा</span>
          </Link>
          <span className={styles.navDivider}>/</span>
          <span className={styles.navTitle}>Audit Log</span>
        </div>
        <div className={styles.navRight}>
          <Link href="/queue" className={styles.navLink}>Queue</Link>
          <Link href="/audit" className={`${styles.navLink} ${styles.navLinkActive}`}>Audit Log</Link>
          <Link href="/settings" className={styles.navLink}>Compliance</Link>
          <Link href="/razorpay-taxonomy" className={styles.navLink}>Taxonomy</Link>
        </div>
      </nav>

      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Audit Log</h1>
          <p className={styles.headerSubtitle}>
            Deterministic ledger recording every automated recovery action, statutory notice compilation, and operator adjudication.
          </p>
        </div>
        <button className={styles.exportBtn} onClick={() => exportCsv(items)}>
          Export CSV ({items.length})
        </button>
      </div>

      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter Event Class:</span>
        <div className={styles.filterGroup}>
          {ACTION_PREFIXES.map((p) => (
            <button
              key={p.value}
              className={`${styles.filterChip} ${prefix === p.value ? styles.filterChipActive : ""}`}
              onClick={() => setPrefix(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isUnauthorized && (
        <div className={styles.authNotice}>
          <span>Operator authentication required to view immutable audit events.</span>
          <Link href="/login" className={styles.signInBtn}>Sign In →</Link>
        </div>
      )}

      {error && <div className={styles.errorNotice}>Notice: {error}</div>}

      {loading && <div className={styles.statusState}>Fetching audit ledger...</div>}

      {!loading && !isUnauthorized && items.length === 0 && (
        <div className={styles.statusState}>No audit events recorded for this category.</div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>OPERATIONAL ACTIVITY</th>
                <th>INITIATOR</th>
                <th>RESOURCE SCOPE</th>
                <th>CORRELATION ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const humanLabel = HUMAN_ACTION_MAP[item.action] || item.action;
                return (
                  <tr key={item.id} className={styles.tableRow}>
                    <td className={styles.monoCell}>{fmt(item.created_at)}</td>
                    <td className={styles.actionCell}>
                      <div className={styles.actionHumanText}>{humanLabel}</div>
                      <span className={styles.actionRawCode}>{item.action}</span>
                    </td>
                    <td>
                      <span className={styles.actorBadge}>{item.actor_type.toUpperCase()}</span>
                    </td>
                    <td>
                      <div className={styles.resourceTypeText}>{item.resource_type}</div>
                      {item.resource_id && item.resource_type === "recovery_case" ? (
                        <Link href={`/cases/${item.resource_id}`} className={styles.resourceLink}>
                          {item.resource_id.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className={styles.monoCell}>
                          {item.resource_id ? item.resource_id.slice(0, 8) + "..." : "—"}
                        </span>
                      )}
                    </td>
                    <td className={styles.monoCell}>
                      {item.correlation_id ? item.correlation_id.slice(0, 16) + "..." : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
