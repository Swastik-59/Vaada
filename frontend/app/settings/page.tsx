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
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep)", color: "var(--text-primary)", fontFamily: "var(--sans)" }}>
      {/* Top Console Navigation */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 36px", height: 52,
        borderBottom: "1px solid var(--border-subtle)",
        backgroundColor: "var(--bg-surface)",
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <Link href="/queue" style={{ fontFamily: "var(--display)", fontSize: "1.25rem", fontWeight: 900, letterSpacing: "0.04em", color: "var(--text-primary)" }}>
            VAADA <span style={{ color: "var(--accent)" }}>वादा</span>
          </Link>
          <span style={{ color: "var(--border-strong)", fontSize: 12 }}>/</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.16em", color: "var(--text-secondary)" }}>
            COMPLIANCE CONFIGURATION
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/queue" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            ← Queue
          </Link>
          <Link href="/audit" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Audit Trail
          </Link>
          <Link href="/settings" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-primary)", textTransform: "uppercase" }}>
            Compliance Config
          </Link>
          <Link href="/razorpay-taxonomy" style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Error Intelligence
          </Link>
        </div>
      </nav>

      <div style={{ padding: "36px 36px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
        <p style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.18em", color: "var(--accent)", margin: "0 0 6px", textTransform: "uppercase" }}>
          ● Enforced Statutory Code Controls
        </p>
        <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(2.2rem,4vw,3.4rem)", fontWeight: 800, lineHeight: 0.95, textTransform: "uppercase", margin: 0, letterSpacing: "-0.01em" }}>
          Compliance Registry
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "8px 0 0", maxWidth: 700 }}>
          Deterministic checks executed on every outbound touchpoint. A failed check aborts outbound delivery at the gateway layer and logs an immutable audit event.
        </p>
      </div>

      {error && (
        <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "#f87171", padding: "16px 36px", borderBottom: "1px solid var(--color-disallowed)", backgroundColor: "rgba(192,32,32,0.1)", margin: 0 }}>
          ⚠️ {error}
        </p>
      )}

      {config && (
        <div style={{ padding: "36px" }}>
          {/* Key values */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, marginBottom: 40 }}>
            {[
              { label: "Contact window start", value: `${String(config.contact_window_start_hour).padStart(2,"0")}:00 ${config.timezone}`, sub: "Legal Indian Calling Slot" },
              { label: "Contact window end", value: `${String(config.contact_window_end_hour).padStart(2,"0")}:00 ${config.timezone}`, sub: "Automatic Nighttime Lockout" },
              { label: "Max contacts / 7 days", value: String(config.max_contacts_per_7_days), sub: "RBI Rolling Anti-Nagging Limit" },
            ].map((item) => (
              <div key={item.label} style={{ padding: "20px 24px", backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: "var(--display)", fontSize: "2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                  {item.value}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--accent)" }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Rules table */}
          <div style={{ border: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-surface)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "rgba(15, 17, 20, 0.95)" }}>
                  {["Statutory Rule Title", "Enforcement Rule Specification", "Engine Status"].map((h) => (
                    <th key={h} style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-muted)", padding: "14px 16px", textAlign: "left", fontWeight: 400 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rules.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "16px", fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{r.title}</td>
                    <td style={{ padding: "16px", fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>{r.description}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        display: "inline-block", padding: "3px 10px",
                        border: "1px solid var(--color-recovered)", color: "var(--color-recovered)",
                        backgroundColor: "rgba(39, 116, 75, 0.1)",
                        fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase",
                      }}>
                        {r.enforced ? "ENFORCED IN CODE" : "DISABLED"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 28, padding: "16px 20px", borderLeft: "3px solid var(--accent)", backgroundColor: "rgba(216, 80, 36, 0.05)", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            These statutory limits are read directly from server environment config. Changing them requires a deployment restart.
            All compliance checks run server-side before outbound messaging. A violation is a hard stop—no warning toast, no retry.
          </div>
        </div>
      )}
    </div>
  );
}
