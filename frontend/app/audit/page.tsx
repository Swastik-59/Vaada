"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import gsap from "gsap";
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
  { label: "All", value: "" },
  { label: "Case events", value: "case." },
  { label: "Ingestion", value: "event." },
  { label: "Auth", value: "auth." },
];

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
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
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/api/v1/audit?limit=200&action_prefix=${encodeURIComponent(prefix)}`)
      .then((data) => setItems(data.items ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [prefix]);

  useEffect(() => {
    if (!loading && tbodyRef.current) {
      const rows = tbodyRef.current.querySelectorAll("tr");
      gsap.from(rows, {
        opacity: 0,
        x: -16,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.02,
      });
    }
  }, [loading]);

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.navMark}>VAADA / AUDIT TRAIL</span>
        <div className={styles.navLinks}>
          <Link href="/queue">← Queue</Link>
          <Link href="/settings">Compliance config</Link>
          <Link href="/razorpay-taxonomy">Error Intelligence</Link>
        </div>
      </nav>

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.headerLabel}>Tamper-evident log</p>
          <h1 className={styles.headerTitle}>Audit trail</h1>
        </div>
        <button className={styles.exportBtn} onClick={() => exportCsv(items)}>
          Export CSV ({items.length} events)
        </button>
      </div>

      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>Filter:</span>
        {ACTION_PREFIXES.map((p) => (
          <button
            key={p.value}
            className={`${styles.filterChip} ${prefix === p.value ? styles.active : ""}`}
            onClick={() => setPrefix(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && <p className={styles.statusRow}>FETCHING AUDIT LOG…</p>}
      {error && <p className={styles.statusRow} style={{ color: "#c02020" }}>{error}</p>}
      {!loading && items.length === 0 && (
        <p className={styles.statusRow}>No audit events found.</p>
      )}

      {!loading && items.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Correlation ID</th>
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.mutedCell}>{fmt(item.created_at)}</td>
                  <td className={styles.actionCell}>{item.action}</td>
                  <td>
                    <span className={styles.actorBadge}>{item.actor_type}</span>
                  </td>
                  <td>
                    <div className={styles.mutedCell}>{item.resource_type}</div>
                    {item.resource_id && item.resource_type === "recovery_case" ? (
                      <Link
                        href={`/cases/${item.resource_id}`}
                        className={styles.resourceLink}
                      >
                        {item.resource_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className={styles.mutedCell}>
                        {item.resource_id ? item.resource_id.slice(0, 8) + "…" : "—"}
                      </span>
                    )}
                  </td>
                  <td className={styles.mutedCell}>
                    {item.correlation_id ? item.correlation_id.slice(0, 16) + "…" : "—"}
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
