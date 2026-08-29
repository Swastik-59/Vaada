"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.location.href = "/queue";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "10vh auto", padding: 24, border: "1px solid var(--line)" }}>
      <p style={{ fontFamily: "var(--mono)", letterSpacing: "0.18em", fontSize: 12 }}>VAAYDA / OPS</p>
      <h1 style={{ fontFamily: "var(--display)", fontSize: "clamp(2.4rem, 7vw, 4.2rem)", lineHeight: 0.9, margin: "8px 0 12px", textTransform: "uppercase" }}>
        Operations sign-in
      </h1>
      <p>Authenticated console. Recovery numbers come from cases, not from this form.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required style={{ width: "100%", marginTop: 6, padding: 8, background: "#111", color: "var(--paper)", border: "1px solid var(--line)" }} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required style={{ width: "100%", marginTop: 6, padding: 8, background: "#111", color: "var(--paper)", border: "1px solid var(--line)" }} />
        </label>
        <button type="submit" style={{ padding: "14px 16px", background: "var(--accent)", color: "var(--bg)", border: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Enter console
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </form>
      <p style={{ marginTop: 24, fontFamily: "var(--mono)", fontSize: 12 }}>
        <Link href="/">← Public site</Link>
      </p>
    </main>
  );
}
