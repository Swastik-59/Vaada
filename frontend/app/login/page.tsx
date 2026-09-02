"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("operator@vaada.local");
  const [password, setPassword] = useState("123456789");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.location.href = "/queue";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const fillDemo = () => {
    setEmail("operator@vaada.local");
    setPassword("123456789");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-deep)",
        color: "var(--text-primary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <main
        style={{
          maxWidth: 480,
          width: "100%",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-strong)",
          padding: 36,
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Top Registration Marks */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--text-muted)",
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: 12,
            marginBottom: 20,
          }}
        >
          <span>SYS // AUTH GATEWAY</span>
          <span>ROLE: RECOVERY OPERATOR</span>
        </div>

        {/* Wordmark */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "2.4rem",
              fontWeight: 900,
              lineHeight: 0.9,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            VAADA <span style={{ color: "var(--accent)" }}>वादा</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.6rem",
              fontWeight: 700,
              textTransform: "uppercase",
              margin: "8px 0 0",
              color: "var(--text-secondary)",
            }}
          >
            Operations Console Sign-in
          </h1>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 24px" }}>
          Authenticated operator workspace. All actions are cryptographically signed and recorded in the immutable audit log.
        </p>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Operator Identity (Email)
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: "var(--bg-deep)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Master Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                padding: "12px 14px",
                backgroundColor: "var(--bg-deep)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                fontFamily: "var(--mono)",
                fontSize: 12,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "14px 20px",
              backgroundColor: "var(--accent)",
              color: "var(--bg-deep)",
              border: "none",
              fontFamily: "var(--mono)",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
              marginTop: 6,
            }}
          >
            {loading ? "Authenticating Operator…" : "Enter Operations Console →"}
          </button>

          {error && (
            <div
              role="alert"
              style={{
                padding: "10px 14px",
                backgroundColor: "rgba(192, 32, 32, 0.15)",
                borderLeft: "3px solid var(--color-disallowed)",
                color: "#f87171",
                fontFamily: "var(--mono)",
                fontSize: 11,
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </form>

        {/* Demo Credentials Helper */}
        <div
          style={{
            marginTop: 24,
            padding: "12px 14px",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-muted)" }}>
            <span>DEMO: operator@vaada.local / 123456789</span>
          </div>
          <button
            type="button"
            onClick={fillDemo}
            style={{
              background: "transparent",
              border: "1px solid var(--border-strong)",
              color: "var(--accent)",
              fontFamily: "var(--mono)",
              fontSize: 9,
              letterSpacing: "0.1em",
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            PRE-FILL
          </button>
        </div>

        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--mono)",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <Link href="/" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>
            ← Public Machine
          </Link>
          <span>ENVIRONMENT: LOCALHOST</span>
        </div>
      </main>
    </div>
  );
}
