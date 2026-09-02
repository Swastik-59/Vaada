"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type ComplianceConfig = {
  contact_window_start_hour: number;
  contact_window_end_hour: number;
  max_contacts_per_7_days: number;
  timezone: string;
  rules: Array<{
    id: string;
    title: string;
    description: string;
    enforced: boolean;
  }>;
};

export default function SettingsPage() {
  const [config, setConfig] = useState<ComplianceConfig | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/api/v1/settings/compliance")
      .then(setConfig)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep)", color: "var(--text-primary)" }}>
      {/* Top Console Navigation */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 48px", height: 80,
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-deep)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <Link href="/queue" style={{ fontFamily: "var(--display)", fontSize: "1.5rem", fontWeight: 300, letterSpacing: "-0.02em", color: "var(--text-primary)", textDecoration: "none" }}>
            Vaada.
          </Link>
          <span style={{ color: "var(--border-strong)" }}>/</span>
          <span style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-secondary)" }}>
            Compliance Configuration
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <Link href="/queue" style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>Queue</Link>
          <Link href="/audit" style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>Audit Trail</Link>
          <Link href="/settings" style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--text-primary)", textDecoration: "none" }}>Compliance Config</Link>
          <Link href="/razorpay-taxonomy" style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--text-secondary)", textDecoration: "none" }}>Taxonomy</Link>
        </div>
      </nav>

      <div style={{ padding: "64px 48px 32px" }}>
        <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(3rem, 5vw, 4.5rem)", fontWeight: 300, lineHeight: 0.9, textTransform: "none", margin: 0, letterSpacing: "-0.02em" }}>
          Compliance Registry
        </h1>
        <p style={{ fontFamily: "var(--sans)", fontSize: 16, color: "var(--text-secondary)", margin: "16px 0 0", maxWidth: 600, lineHeight: 1.5 }}>
          Deterministic checks executed on every outbound touchpoint. A failed check aborts outbound delivery at the gateway layer and logs an immutable audit event.
        </p>
      </div>

      {error && (
        <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--color-disallowed)", padding: "16px 48px", backgroundColor: "rgba(138, 54, 54, 0.1)", margin: 0 }}>
          {error}
        </p>
      )}

      {config && (
        <div style={{ padding: "32px 48px 64px", maxWidth: 1200 }}>
          {/* Key values */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32, marginBottom: 64 }}>
            {[
              { label: "Contact window start", value: `${String(config.contact_window_start_hour).padStart(2,"0")}:00 ${config.timezone}`, sub: "Legal Indian Calling Slot" },
              { label: "Contact window end", value: `${String(config.contact_window_end_hour).padStart(2,"0")}:00 ${config.timezone}`, sub: "Automatic Nighttime Lockout" },
              { label: "Max contacts / 7 days", value: String(config.max_contacts_per_7_days), sub: "RBI Rolling Anti-Nagging Limit" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontFamily: "var(--display)", fontSize: "2.5rem", fontWeight: 300, color: "var(--text-primary)" }}>
                  {item.value}
                </div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 13, color: "var(--text-muted)" }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Rules table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Statutory Rule Title", "Enforcement Rule Specification", "Engine Status"].map((h) => (
                    <th key={h} style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--text-muted)", padding: "16px 24px", textAlign: "left", fontWeight: 400, borderBottom: "1px solid var(--border-subtle)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rules.map((r) => (
                  <tr key={r.id} style={{ transition: "background-color 0.2s ease" }}>
                    <td style={{ padding: "24px", fontWeight: 500, fontSize: 15, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)", fontFamily: "var(--sans)" }}>{r.title}</td>
                    <td style={{ padding: "24px", fontFamily: "var(--sans)", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, borderBottom: "1px solid var(--border-subtle)" }}>{r.description}</td>
                    <td style={{ padding: "24px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span style={{
                        display: "inline-block", padding: "4px 12px",
                        color: r.enforced ? "var(--color-recovered)" : "var(--text-secondary)",
                        background: r.enforced ? "rgba(46, 96, 71, 0.1)" : "rgba(255, 255, 255, 0.05)",
                        fontFamily: "var(--sans)", fontSize: 12, borderRadius: 100
                      }}>
                        {r.enforced ? "Enforced" : "Disabled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
