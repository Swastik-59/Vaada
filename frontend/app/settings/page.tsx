"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import DashboardNav from "@/components/DashboardNav";

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
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [currentIstHour, setCurrentIstHour] = useState<number | null>(null);

  useEffect(() => {
    try {
      const now = new Date();
      const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const istDate = new Date(istString);
      setCurrentIstHour(istDate.getHours() + istDate.getMinutes() / 60);
    } catch (e) {}

    apiFetch("/api/v1/settings/compliance")
      .then(setConfig)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          setIsUnauthorized(true);
        } else {
          setError(msg);
        }
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-deep)", color: "var(--text-primary)" }}>
      {/* Top Console Navigation */}
      <DashboardNav title="Compliance Rules" />

      <div style={{ padding: "48px 40px 24px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 600, color: "var(--accent)", letterSpacing: "0.1em", marginBottom: 8 }}>
          STATUTORY CODE CONTROLS
        </div>
        <h1
          style={{
            fontFamily: "var(--sans)",
            fontSize: "2.25rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: 0,
            color: "var(--text-primary)",
          }}
        >
          Compliance Registry
        </h1>
        <p
          style={{
            fontFamily: "var(--sans)",
            fontSize: 14.5,
            color: "var(--text-secondary)",
            margin: "12px 0 0",
            maxWidth: 680,
            lineHeight: 1.5,
          }}
        >
          Deterministic compliance checks executed server-side before outbound communication.
          A failed rule aborts message delivery and records a tamper-evident audit log.
        </p>
      </div>

      {isUnauthorized && (
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto 32px",
            padding: "16px 20px",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--accent)",
            borderRadius: 6,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13.5,
          }}
        >
          <span>Operator authentication required to modify compliance parameters.</span>
          <Link
            href="/login"
            style={{
              backgroundColor: "var(--accent)",
              color: "#000",
              padding: "8px 16px",
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Sign In →
          </Link>
        </div>
      )}

      {error && (
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto 32px",
            padding: "14px 20px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid var(--color-disallowed)",
            borderRadius: 6,
            color: "var(--color-disallowed)",
            fontSize: 13,
          }}
        >
          Notice: {error}
        </div>
      )}

      {config && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px 64px" }}>
          {/* Key Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 36 }}>
            {[
              {
                label: "CONTACT WINDOW START",
                value: `${String(config.contact_window_start_hour).padStart(2, "0")}:00 ${config.timezone}`,
                sub: "Legal Indian Calling Slot (RBI)",
              },
              {
                label: "CONTACT WINDOW END",
                value: `${String(config.contact_window_end_hour).padStart(2, "0")}:00 ${config.timezone}`,
                sub: "Automated Nighttime Lockout",
              },
              {
                label: "MAX CONTACTS / 7 DAYS",
                value: `${config.max_contacts_per_7_days} Attempts`,
                sub: "Rolling Anti-Nagging Guardrail",
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", color: "var(--text-muted)" }}>
                  {item.label}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {item.value}
                </div>
                <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--text-secondary)" }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Rules Table */}
          <div style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 6, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  {["STATUTORY RULE TITLE", "ENFORCEMENT SPECIFICATION", "ENGINE STATUS"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 20px",
                        backgroundColor: "var(--bg-elevated)",
                        borderBottom: "1px solid var(--border-subtle)",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        color: "var(--text-muted)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.rules.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: "18px 20px", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", borderBottom: "1px solid var(--border-subtle)" }}>
                      {r.title}
                    </td>
                    <td style={{ padding: "18px 20px", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5, borderBottom: "1px solid var(--border-subtle)" }}>
                      <div>{r.description}</div>
                      {r.id === "contact_window" && (
                        <div style={{ marginTop: 14, maxWidth: 360 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 6 }}>
                            <span>00:00</span>
                            <span style={{ color: "var(--accent)", fontWeight: 600 }}>09:00–20:00 IST Permitted Slot</span>
                            <span>24:00</span>
                          </div>
                          <div style={{ position: "relative", width: "100%", height: 8, backgroundColor: "var(--border-strong)", borderRadius: 4 }}>
                            {/* Permitted window slot */}
                            <div
                              style={{
                                position: "absolute",
                                left: `${(9 / 24) * 100}%`,
                                width: `${(11 / 24) * 100}%`,
                                height: "100%",
                                backgroundColor: "var(--accent)",
                                borderRadius: 2,
                              }}
                            />
                            {/* Current time marker */}
                            {currentIstHour != null && (
                              <div
                                title={`Current IST: ${Math.floor(currentIstHour)}:${String(Math.floor((currentIstHour % 1) * 60)).padStart(2, "0")}`}
                                style={{
                                  position: "absolute",
                                  left: `${Math.min(100, Math.max(0, (currentIstHour / 24) * 100))}%`,
                                  top: -3,
                                  width: 14,
                                  height: 14,
                                  borderRadius: "50%",
                                  backgroundColor: "var(--status-recovered)",
                                  border: "2px solid var(--bg-surface)",
                                  transform: "translateX(-50%)",
                                  boxShadow: "0 0 8px rgba(34, 201, 151, 0.8)",
                                  cursor: "pointer",
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "18px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          color: r.enforced ? "var(--status-recovered)" : "var(--text-muted)",
                          backgroundColor: r.enforced ? "rgba(34, 201, 151, 0.12)" : "var(--bg-elevated)",
                          border: `1px solid ${r.enforced ? "rgba(34, 201, 151, 0.3)" : "var(--border-subtle)"}`,
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          borderRadius: 4,
                        }}
                      >
                        {r.enforced ? "ENFORCED IN CODE" : "DISABLED"}
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
