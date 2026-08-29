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

  const navStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 32px", height: 44,
    borderBottom: "1px solid var(--line)",
    fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--paper)", fontFamily: "var(--sans)" }}>
      <nav style={navStyle}>
        <span style={{ opacity: 0.8 }}>VAAYDA / COMPLIANCE CONFIG</span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/queue" style={{ color: "var(--muted)" }}>← Queue</Link>
          <Link href="/audit" style={{ color: "var(--muted)" }}>Audit trail</Link>
        </div>
      </nav>

      <div style={{ padding: "40px 32px 24px", borderBottom: "1px solid var(--line)" }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--muted)", margin: "0 0 6px", textTransform: "uppercase" }}>
          Enforced policies
        </p>
        <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(2rem,5vw,3.2rem)", fontWeight: 800, lineHeight: 0.9, textTransform: "uppercase", margin: 0 }}>
          Compliance rules
        </h1>
      </div>

      {error && (
        <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#c02020", padding: "20px 32px", borderLeft: "2px solid #8f1d1d", margin: "16px 32px" }}>
          {error}
        </p>
      )}

      {config && (
        <div style={{ padding: "32px" }}>
          {/* Key values */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginBottom: 40 }}>
            {[
              { label: "Contact window start", value: `${String(config.contact_window_start_hour).padStart(2,"0")}:00 ${config.timezone}` },
              { label: "Contact window end", value: `${String(config.contact_window_end_hour).padStart(2,"0")}:00 ${config.timezone}` },
              { label: "Max contacts / 7 days", value: String(config.max_contacts_per_7_days) },
            ].map((item) => (
              <div key={item.label} style={{ padding: "20px 24px", border: "1px solid var(--line)" }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: "var(--display)", fontSize: "1.8rem", fontWeight: 800, color: "var(--accent)" }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Rules table */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Rule", "Description", "Status"].map((h) => (
                  <th key={h} style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--muted)", padding: "10px 8px", textAlign: "left", fontWeight: 400 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.rules.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "14px 8px", fontWeight: 500 }}>{r.title}</td>
                  <td style={{ padding: "14px 8px", fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{r.description}</td>
                  <td style={{ padding: "14px 8px" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 10px",
                      border: "1px solid #2a6b48", color: "#3a9b65",
                      fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    }}>
                      {r.enforced ? "ENFORCED" : "DISABLED"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 32, fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
            These values are read directly from backend configuration. Changing them requires a server restart.<br />
            All checks run server-side before any outbound action. A failed check is a hard stop — no warning toast, no retry.
          </p>
        </div>
      )}
    </div>
  );
}
