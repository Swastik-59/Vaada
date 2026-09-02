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
          maxWidth: 440,
          width: "100%",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--display)",
              fontSize: "3.5rem",
              fontWeight: 300,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginBottom: 16,
            }}
          >
            Vaada.
          </div>
          <h1
            style={{
              fontFamily: "var(--sans)",
              fontSize: "16px",
              fontWeight: 400,
              color: "var(--text-secondary)",
              margin: 0,
            }}
          >
            Sign in to the Operations Console
          </h1>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 24 }}>
          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--sans)",
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              Email Address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                fontFamily: "var(--sans)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--text-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontFamily: "var(--sans)",
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 8,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                fontFamily: "var(--sans)",
                fontSize: 14,
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--text-primary)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "16px 24px",
              backgroundColor: "var(--accent)",
              color: "var(--bg-deep)",
              border: "none",
              borderRadius: 100,
              fontFamily: "var(--sans)",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
              transition: "transform 0.2s ease, background-color 0.2s",
              marginTop: 8,
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>

          {error && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(138, 54, 54, 0.1)",
                color: "var(--color-disallowed)",
                fontFamily: "var(--sans)",
                fontSize: 13,
                borderRadius: 4,
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}
        </form>

        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            fontFamily: "var(--sans)",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <button
            type="button"
            onClick={fillDemo}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Use Demo Account
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Link href="/" style={{ textDecoration: "none", color: "var(--text-secondary)", fontFamily: "var(--sans)", fontSize: 13 }}>
            ← Back to Public Site
          </Link>
        </div>
      </main>
    </div>
  );
}
