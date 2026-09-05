"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import AuthenticatedAppShell from "@/components/AuthenticatedAppShell";
import styles from "./taxonomy.module.css";

interface OfficialRecord {
  id: string;
  provider: string;
  category: string;
  payment_method: string | null;
  code: string;
  reason: string;
  description: string;
  source: string;
  step: string;
  official_next_step: string;
  official_source_url: string;
  source_type: string;
  taxonomy_version: string;
  retrieved_at: string;
}

interface DerivedRecord {
  recoverability: string;
  retryable: boolean;
  urgency: string;
  recommended_customer_action: string;
  recommended_merchant_action: string;
  preferred_channel: string;
  requires_human_review: boolean;
  policy_decision: string;
  is_unmapped?: boolean;
}

interface TaxonomyItem {
  id: string;
  official: OfficialRecord;
  derived: DerivedRecord;
}

interface TaxonomyResponse {
  metadata: {
    provider: string;
    source: string;
    taxonomy_version: string;
    retrieved_at: string;
    source_urls: string[];
    provenance_notes: string;
  };
  total: number;
  items: TaxonomyItem[];
}

export default function RazorpayTaxonomyPage() {
  const [data, setData] = useState<TaxonomyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [recoverabilityFilter, setRecoverabilityFilter] = useState("all");

  // Selected item for drawer
  const [selectedItem, setSelectedItem] = useState<TaxonomyItem | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Simulator state
  const [simCode, setSimCode] = useState("BAD_REQUEST_ERROR");
  const [simReason, setSimReason] = useState("insufficient_funds");
  const [simMethod, setSimMethod] = useState("upi");
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    async function loadTaxonomy() {
      try {
        setLoading(true);
        const res = await apiFetch("/api/v1/razorpay/taxonomy");
        setData(res);
        if (res.items && res.items.length > 0) {
          setSelectedItem(res.items[0]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load Razorpay taxonomy.");
      } finally {
        setLoading(false);
      }
    }
    loadTaxonomy();
  }, []);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      const off = item.official;
      const der = item.derived;

      // Method filter
      if (methodFilter !== "all") {
        if ((off.payment_method || "").toLowerCase() !== methodFilter.toLowerCase()) {
          return false;
        }
      }

      // Source filter
      if (sourceFilter !== "all") {
        if (off.source.toLowerCase() !== sourceFilter.toLowerCase()) {
          return false;
        }
      }

      // Recoverability filter
      if (recoverabilityFilter !== "all") {
        if (der.recoverability.toLowerCase() !== recoverabilityFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesCode = off.code.toLowerCase().includes(q);
        const matchesReason = off.reason.toLowerCase().includes(q);
        const matchesDesc = off.description.toLowerCase().includes(q);
        const matchesNext = off.official_next_step.toLowerCase().includes(q);
        const matchesPolicy = (der.policy_decision || "").toLowerCase().includes(q);
        if (!matchesCode && !matchesReason && !matchesDesc && !matchesNext && !matchesPolicy) {
          return false;
        }
      }

      return true;
    });
  }, [data, search, methodFilter, sourceFilter, recoverabilityFilter]);

  async function handleSimulate() {
    setSimLoading(true);
    try {
      const res = await apiFetch("/api/v1/razorpay/lookup", {
        method: "POST",
        body: JSON.stringify({
          code: simCode.trim(),
          reason: simReason.trim() || undefined,
          payment_method: simMethod || undefined,
        }),
      });
      setSimResult(res);
    } catch (err: any) {
      setSimResult({ error: err.message });
    } finally {
      setSimLoading(false);
    }
  }

  function handlePreset(code: string, reason: string, method: string) {
    setSimCode(code);
    setSimReason(reason);
    setSimMethod(method);
    setSimResult(null);
  }

  return (
    <AuthenticatedAppShell title="Gateway Taxonomy">
      <div className={styles.container}>
        {/* Page Header */}
        <header className={styles.header}>
          <div className={styles.eyebrow}>
            Payment Gateway Failure Taxonomy
          </div>
          <h1 className={styles.title}>Razorpay Error Intelligence</h1>
          <p className={styles.subtitle}>
            A locally versioned catalog of Razorpay published payment failure taxonomy.
            Deterministic lookups separate official gateway diagnostics from Vaada automated recovery policies.
          </p>

          <div className={styles.metaRow}>
            <span className={styles.metaBadge}>
              Version: {data?.metadata.taxonomy_version ?? "razorpay-taxonomy-2026-09-01"}
            </span>
            <span className={styles.metaItem}>
              Active Records: <strong>{data?.total ?? 38} published failure codes</strong>
            </span>
            <span className={styles.metaItem}>
              Official Sources: <strong>5 Razorpay developer documents</strong>
            </span>
            <span className={styles.metaItem}>
              Policy Engine: <strong>Rule-based statutory routing</strong>
            </span>
          </div>
        </header>

        {/* Filter Controls */}
        <div className={styles.filterBar}>
          <div className={styles.searchRow}>
            <input
              type="text"
              placeholder="Search error code, reason (e.g. insufficient_funds), description, or policy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Method:</span>
            {["all", "upi", "card", "netbanking", "mandate", "payment"].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`${styles.filterBtn} ${methodFilter === m ? styles.active : ""}`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Source:</span>
            {["all", "customer", "gateway", "business", "razorpay"].map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`${styles.filterBtn} ${sourceFilter === s ? styles.active : ""}`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>

          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Recovery:</span>
            {["all", "recoverable", "unrecoverable", "needs_investigation"].map((r) => (
              <button
                key={r}
                onClick={() => setRecoverabilityFilter(r)}
                className={`${styles.filterBtn} ${recoverabilityFilter === r ? styles.active : ""}`}
              >
                {r.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "var(--mono)", color: "var(--muted)" }}>
            Loading versioned Razorpay taxonomy...
          </div>
        )}

        {error && (
          <div style={{ padding: 20, background: "rgba(239, 68, 68, 0.1)", border: "1px solid #ef4444", color: "#f87171", fontFamily: "var(--mono)", marginBottom: 24 }}>
            Error: {error}
          </div>
        )}

        {/* Master View + Inspection Drawer */}
        {!loading && !error && (
          <div className={styles.viewGrid}>
            {/* Table */}
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Reason</th>
                    <th>Method</th>
                    <th>Source / Step</th>
                    <th>Official Description</th>
                    <th>Recovery Policy</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--muted)", fontFamily: "var(--mono)" }}>
                        No taxonomy records matched the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      const isGateway = item.official.code === "GATEWAY_ERROR";
                      const recClass =
                        item.derived.recoverability === "recoverable"
                          ? styles.policyRecoverable
                          : item.derived.recoverability === "unrecoverable"
                          ? styles.policyUnrecoverable
                          : styles.policyInvestigation;

                      return (
                        <tr
                          key={item.id}
                          className={isSelected ? styles.selected : ""}
                          onClick={() => setSelectedItem(item)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <span className={isGateway ? styles.codeBadgeGateway : styles.codeBadge}>
                              {item.official.code}
                            </span>
                          </td>
                          <td>
                            <span className={styles.reasonText}>{item.official.reason}</span>
                          </td>
                          <td>
                            <span className={styles.methodBadge}>
                              {item.official.payment_method ?? "COMMON"}
                            </span>
                          </td>
                          <td>
                            <div className={styles.sourceStep}>
                              <span>{item.official.source}</span>
                              <span style={{ color: "var(--line)", margin: "0 4px" }}>/</span>
                              <span style={{ color: "#94a3b8" }}>{item.official.step}</span>
                            </div>
                          </td>
                          <td style={{ maxWidth: 320, lineHeight: 1.4 }}>
                            {item.official.description}
                          </td>
                          <td>
                            <span className={`${styles.policyTag} ${recClass}`}>
                              {item.derived.policy_decision}
                            </span>
                          </td>
                          <td>
                            <button
                              className={styles.inspectBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                              }}
                            >
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Inspection Drawer */}
            {selectedItem && (
              <aside className={styles.drawer}>
                <div className={styles.drawerHeader}>
                  <div>
                    <h2 className={styles.drawerTitle}>{selectedItem.official.reason}</h2>
                    <span className={styles.drawerSubtitle}>ID: {selectedItem.id}</span>
                  </div>
                  <button className={styles.closeBtn} onClick={() => setSelectedItem(null)} title="Close drawer">
                    ✕
                  </button>
                </div>

                <div className={styles.drawerBody}>
                  {/* Official Razorpay Section */}
                  <div className={styles.sectionBox}>
                    <div className={styles.sectionTitle}>
                      <span>OFFICIAL RAZORPAY SPECIFICATION</span>
                      <span style={{ color: "#38bdf8" }}>VERBATIM</span>
                    </div>

                    <div className={styles.fieldGrid}>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Code</span>
                        <span className={styles.fieldVal}>{selectedItem.official.code}</span>
                      </div>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Payment Method</span>
                        <span className={styles.fieldVal}>{selectedItem.official.payment_method ?? "COMMON"}</span>
                      </div>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Failure Source</span>
                        <span className={styles.fieldVal}>{selectedItem.official.source}</span>
                      </div>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Payment Step</span>
                        <span className={styles.fieldVal}>{selectedItem.official.step}</span>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <span className={styles.fieldKey}>Official Description:</span>
                      <p className={styles.descBlock}>{selectedItem.official.description}</p>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <span className={styles.fieldKey}>Official Next Step:</span>
                      <div className={styles.nextStepBlock}>
                        {selectedItem.official.official_next_step}
                      </div>
                    </div>

                    <a
                      href={selectedItem.official.official_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sourceLink}
                    >
                      <span>View official Razorpay documentation</span>
                      <span>↗</span>
                    </a>
                  </div>

                  {/* Derived Recovery Logic Section */}
                  <div className={styles.sectionBox} style={{ borderColor: "rgba(56, 189, 248, 0.3)" }}>
                    <div className={styles.sectionTitle}>
                      <span>VAADA RECOVERY INTELLIGENCE</span>
                      <span style={{ color: "#4ade80" }}>DERIVED</span>
                    </div>

                    <div className={styles.fieldGrid}>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Recoverability</span>
                        <span className={styles.fieldVal} style={{ textTransform: "uppercase" }}>
                          {selectedItem.derived.recoverability}
                        </span>
                      </div>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Retryable</span>
                        <span className={styles.fieldVal}>
                          {selectedItem.derived.retryable ? "YES (Instant Retry)" : "NO (Switch Rail)"}
                        </span>
                      </div>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Urgency</span>
                        <span className={styles.fieldVal} style={{ textTransform: "uppercase" }}>
                          {selectedItem.derived.urgency}
                        </span>
                      </div>
                      <div className={styles.fieldItem}>
                        <span className={styles.fieldKey}>Human Review</span>
                        <span className={styles.fieldVal}>
                          {selectedItem.derived.requires_human_review ? "REQUIRED" : "AUTOMATED"}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <span className={styles.fieldKey}>Recommended Merchant Action:</span>
                      <p className={styles.descBlock} style={{ color: "#38bdf8" }}>
                        {selectedItem.derived.recommended_merchant_action}
                      </p>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <span className={styles.fieldKey}>Recommended Customer Action:</span>
                      <p className={styles.descBlock}>
                        {selectedItem.derived.recommended_customer_action}
                      </p>
                    </div>
                  </div>

                  {/* Raw JSON inspection */}
                  <div className={styles.sectionBox}>
                    <div className={styles.sectionTitle}>
                      <span>RAW TAXONOMY RECORD</span>
                      <button
                        style={{
                          background: "transparent",
                          border: "1px solid var(--line)",
                          color: "var(--muted)",
                          fontSize: 9,
                          padding: "2px 6px",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(selectedItem, null, 2));
                          setCopiedId(true);
                          setTimeout(() => setCopiedId(false), 2000);
                        }}
                      >
                        {copiedId ? "COPIED ✓" : "COPY JSON"}
                      </button>
                    </div>
                    <pre style={{ margin: 0, fontSize: 10, fontFamily: "var(--mono)", color: "#94a3b8", maxHeight: 180, overflowY: "auto" }}>
                      {JSON.stringify(selectedItem, null, 2)}
                    </pre>
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Diagnostic Simulator Sandbox */}
        <section className={styles.simulator}>
          <div className={styles.simHeader}>
            <h2 className={styles.simTitle}>Taxonomy Lookup & Diagnostic Sandbox</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className={styles.filterBtn}
                onClick={() => handlePreset("BAD_REQUEST_ERROR", "insufficient_funds", "upi")}
              >
                UPI Insufficient Funds
              </button>
              <button
                className={styles.filterBtn}
                onClick={() => handlePreset("BAD_REQUEST_ERROR", "card_declined_by_bank", "card")}
              >
                Card Declined by Bank
              </button>
              <button
                className={styles.filterBtn}
                onClick={() => handlePreset("BAD_REQUEST_ERROR", "mandate_cancelled", "mandate")}
              >
                Mandate Cancelled
              </button>
              <button
                className={styles.filterBtn}
                onClick={() => handlePreset("GATEWAY_ERROR", "unmapped_bank_anomaly_99", "upi")}
              >
                Simulate Unmapped Error
              </button>
            </div>
          </div>

          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
            Test raw error payloads against the deterministic taxonomy lookup service. Zero hallucination is guaranteed:
            unmapped errors will be honestly flagged without invented explanations.
          </p>

          <div className={styles.simControls}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                ERROR CODE:
              </label>
              <input
                type="text"
                value={simCode}
                onChange={(e) => setSimCode(e.target.value)}
                className={styles.searchInput}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                FAILURE REASON:
              </label>
              <input
                type="text"
                value={simReason}
                onChange={(e) => setSimReason(e.target.value)}
                className={styles.searchInput}
                style={{ width: "100%", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ width: 140 }}>
              <label style={{ display: "block", fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
                METHOD:
              </label>
              <select
                value={simMethod}
                onChange={(e) => setSimMethod(e.target.value)}
                className={styles.searchInput}
                style={{ width: "100%", height: 38, boxSizing: "border-box" }}
              >
                <option value="upi">UPI</option>
                <option value="card">Card</option>
                <option value="netbanking">Netbanking</option>
                <option value="mandate">Mandate</option>
                <option value="payment">General Payment</option>
              </select>
            </div>
          </div>

          <button className={styles.simActionBtn} onClick={handleSimulate} disabled={simLoading}>
            {simLoading ? "Normalizing..." : "Simulate Normalization & Policy Lookup →"}
          </button>

          {simResult && (
            <div className={styles.simResult}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, borderBottom: "1px solid var(--line)", paddingBottom: 6 }}>
                <span style={{ color: simResult.matched ? "#4ade80" : "#fbbf24", fontWeight: 600 }}>
                  {simResult.matched ? "OFFICIAL TAXONOMY MATCHED" : "UNMAPPED — FLAGGED FOR HUMAN REVIEW"}
                </span>
                <span style={{ color: "var(--muted)" }}>Provider: {simResult.provider}</span>
              </div>
              <pre style={{ margin: 0, color: "#cbd5e1" }}>
                {JSON.stringify(simResult, null, 2)}
              </pre>
            </div>
          )}
        </section>
      </div>
    </AuthenticatedAppShell>
  );
}
