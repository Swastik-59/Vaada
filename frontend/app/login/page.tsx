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
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function quickDemoLogin() {
    setEmail("operator@vaada.local");
    setPassword("123456789");
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "operator@vaada.local", password: "123456789" }),
      });
      window.location.href = "/queue";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

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
          maxWidth: 420,
          width: "100%",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          padding: 40,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span>VAADA</span>
            <span style={{ color: "var(--accent)", fontSize: "1.1rem" }}>वादा</span>
          </div>
          <p
            style={{
              fontFamily: "var(--sans)",
              fontSize: "14px",
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            Operator authentication for recovery console
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 18 }}>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              Operator Email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                fontFamily: "var(--sans)",
                fontSize: 13.5,
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
                letterSpacing: "0.08em",
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
                padding: "10px 14px",
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                fontFamily: "var(--sans)",
                fontSize: 13.5,
                outline: "none",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "12px",
              backgroundColor: "var(--accent)",
              color: "#000",
              border: "none",
              borderRadius: 4,
              fontFamily: "var(--sans)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Authenticating..." : "Enter Operations Console →"}
          </button>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                border: "1px solid var(--color-disallowed)",
                color: "var(--color-disallowed)",
                fontFamily: "var(--sans)",
                fontSize: 12.5,
                borderRadius: 4,
              }}
            >
              {error}
            </div>
          )}
        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 16,
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 12.5,
            fontFamily: "var(--sans)",
          }}
        >
          <button
            type="button"
            onClick={quickDemoLogin}
            disabled={loading}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent)",
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Instant Demo Sign In →
          </button>

          <Link href="/" style={{ color: "var(--text-secondary)" }}>
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
