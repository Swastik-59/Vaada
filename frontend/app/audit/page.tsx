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
  { label: "All Events", value: "" },
  { label: "Case Events", value: "case." },
  { label: "Ingestion", value: "event." },
  { label: "Auth", value: "auth." },
];

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function exportCsv(items: AuditEvent[]) {
  const header = "timestamp,action,actor_type,actor_id,resource_type,resource_id,correlation_id";
  const rows = items.map((i) =>
    [
      i.created_at ?? "",
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
  a.download = `vaada-audit-${Date.now()}.csv`;
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
      <nav className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/queue" className={styles.navBrand}>
            VAADA <span className={styles.navDevanagari}>वादा</span>
          </Link>
          <span className={styles.navDivider}>/</span>
          <span className={styles.navTitle}>IMMUTABLE AUDIT TRAIL</span>
        </div>
        <div className={styles.navRight}>
          <Link href="/queue" className={styles.navLink}>Queue</Link>
          <Link href="/audit" className={`${styles.navLink} ${styles.navLinkActive}`}>Audit Trail</Link>
          <Link href="/settings" className={styles.navLink}>Compliance</Link>
          <Link href="/razorpay-taxonomy" className={styles.navLink}>Taxonomy</Link>
        </div>
      </nav>

      <div className={styles.header}>
        <div>
          <div className={styles.headerTag}>TAMPER-EVIDENT APPEND-ONLY LOG</div>
          <h1 className={styles.headerTitle}>System Audit Trail</h1>
          <p className={styles.headerSubtitle}>
            Cryptographically verifiable audit log tracking every autonomous state transition, human escalation, and statutory notice.
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

      {loading && <div className={styles.statusState}>Fetching Audit Log...</div>}

      {!loading && !isUnauthorized && items.length === 0 && (
        <div className={styles.statusState}>No audit events recorded for this category.</div>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>ACTION</th>
                <th>ACTOR TYPE</th>
                <th>RESOURCE</th>
                <th>CORRELATION ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={styles.tableRow}>
                  <td className={styles.monoCell}>{fmt(item.created_at)}</td>
                  <td className={styles.actionCell}>{item.action}</td>
                  <td>
                    <span className={styles.actorBadge}>{item.actor_type}</span>
                  </td>
                  <td>
                    <div className={styles.monoCell}>{item.resource_type}</div>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
