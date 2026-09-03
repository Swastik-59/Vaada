"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import styles from "./login.module.css";

export default function LoginPage() {
  const [email, setEmail] = useState("operator@vaada.local");
  const [password, setPassword] = useState("123456789");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [istTime, setIstTime] = useState("");

  useEffect(() => {
    function updateClock() {
      try {
        const now = new Date();
        const ist = now.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setIstTime(ist);
      } catch (e) {}
    }
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

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
    <div className={styles.loginContainer}>
      {/* ── Left Column: Editorial & Institutional Authority ── */}
      <div className={styles.leftEditorialCol}>
        <div className={styles.leftTopBrand}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className={styles.brandName}>VAADA</span>
            <span className={styles.brandDevanagari}>वादा</span>
          </Link>
        </div>

        <div className={styles.editorialCenter}>
          <h1 className={styles.editorialHeadline}>
            Bounded B2B Receivables Recovery Console
          </h1>

          <div className={styles.statutoryList}>
            <div className={styles.statutoryItem}>
              <span className={styles.statutoryCheck}>✓</span>
              <span className={styles.statutoryText}>
                <strong>RBI Fair Practices Window:</strong> Automated outbound contact permitted strictly between 09:00 and 20:00 IST.
              </span>
            </div>

            <div className={styles.statutoryItem}>
              <span className={styles.statutoryCheck}>✓</span>
              <span className={styles.statutoryText}>
                <strong>Section 43B(h) Enforcement:</strong> 45-day statutory tax disallowance tracking for MSMED Act compliant claims.
              </span>
            </div>

            <div className={styles.statutoryItem}>
              <span className={styles.statutoryCheck}>✓</span>
              <span className={styles.statutoryText}>
                <strong>Audited Adjudication:</strong> Immutable event ledger preserving cryptographic evidence of human operator overrides.
              </span>
            </div>
          </div>
        </div>

        <div className={styles.leftBottomClock}>
          <div className={styles.clockDot} />
          <span>{istTime || "09:00:00"} IST · REGULATORY CONTACT WINDOW</span>
        </div>
      </div>

      {/* ── Right Column: Interactive Sign In ── */}
      <div className={styles.rightFormCol}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Operator Authentication</h2>
            <p className={styles.formSub}>
              Enter administrative credentials to open the active receivable recovery queue.
            </p>
          </div>

          {/* 1-Click Demo Credential Box */}
          <div className={styles.demoPillBox}>
            <div className={styles.demoCreds}>
              operator@vaada.local / 123456789
            </div>
            <button
              type="button"
              className={styles.fillDemoBtn}
              onClick={() => {
                setEmail("operator@vaada.local");
                setPassword("123456789");
              }}
            >
              Fill Demo
            </button>
          </div>

          {error && <div className={styles.formError}>{error}</div>}

          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Operator Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Master Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={styles.formInput}
              />
            </div>

            <button type="submit" disabled={loading} className={styles.signInBtn}>
              {loading ? "Verifying..." : "Sign In to Console →"}
            </button>
          </form>

          <div className={styles.bypassDivider}>
            <span>OR INSTANT BYPASS</span>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={quickDemoLogin}
            className={styles.quickBypassBtn}
          >
            Instant Demo Sign In (Evaluator Mode)
          </button>
        </div>
      </div>
    </div>
  );
}
