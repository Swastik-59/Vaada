"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import styles from "./login.module.css";

type TabMode = "signin" | "signup" | "forgot";

function getSafeNextUrl(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  // Ensure relative path starting with / and not protocol-relative (//)
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return fallback;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextRaw = searchParams.get("next");
  const { refreshAuth } = useAuth();

  const [tab, setTab] = useState<TabMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [istTime, setIstTime] = useState("");

  // Forgot Password / Reset state
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

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

  useEffect(() => {
    apiFetch("/api/v1/auth/config")
      .then((cfg: { demo_mode?: boolean }) => {
        const isDemo = Boolean(cfg?.demo_mode);
        setDemoMode(isDemo);
        if (isDemo) {
          setEmail("operator@vaada.local");
          setPassword("123456789");
        }
      })
      .catch(() => {
        setDemoMode(false);
      });
  }, []);

  async function onSignIn(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const profile = await refreshAuth();
      const fallbackUrl = profile?.uid ? `/queue/${profile.uid}` : "/queue";
      const targetUrl = getSafeNextUrl(nextRaw, fallbackUrl);
      router.push(targetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSignUp(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== passwordConfirm) {
      setError("Password confirmation does not match.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
          password_confirm: passwordConfirm,
          tenant_name: tenantName.trim() || undefined,
        }),
      });
      const profile = await refreshAuth();
      const fallbackUrl = profile?.uid ? `/queue/${profile.uid}` : "/queue";
      const targetUrl = getSafeNextUrl(nextRaw, fallbackUrl);
      router.push(targetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account registration failed");
    } finally {
      setLoading(false);
    }
  }

  async function onForgotPassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess("If an account exists with this email, password reset instructions have been dispatched.");
      if (res.demo_reset_token) {
        setResetToken(res.demo_reset_token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset request failed");
    } finally {
      setLoading(false);
    }
  }

  async function onCompleteReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await apiFetch("/api/v1/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: resetToken.trim(), new_password: newPassword }),
      });
      setSuccess("Password successfully updated. You may now sign in with your new password.");
      setTab("signin");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.loginContainer}>
      {/* Background Ambience */}
      <div className={styles.bgGlow} />

      {/* Top Header */}
      <header className={styles.topHeader}>
        <Link href="/" className={styles.brandMark}>
          <span>VAADA</span>
          <span className={styles.brandDevanagari}>वादा</span>
        </Link>
        <div className={styles.istClock}>
          <span className={styles.clockDot} />
          <span>{istTime || "09:00:00 IST"} · Asia/Kolkata</span>
        </div>
      </header>

      {/* Central Login Card */}
      <main className={styles.mainWrapper}>
        <div className={styles.authCard}>
          <div className={styles.cardHeader}>
            <span className={styles.subTag}>ENTERPRISE ACCESS PORTAL</span>
            <h1 className={styles.headline}>
              {tab === "signin"
                ? "Sign In to Workspace"
                : tab === "signup"
                ? "Register Organization"
                : "Reset Account Access"}
            </h1>
            <p className={styles.cardDesc}>
              {tab === "signin"
                ? "Authenticate with your corporate credentials to access your bounded recovery workspace."
                : tab === "signup"
                ? "Create an enterprise workspace with cryptographic user isolation and statutory audit trails."
                : "Enter your registered corporate email to receive secure single-use recovery instructions."}
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className={styles.tabBar}>
            <button
              className={tab === "signin" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => {
                setTab("signin");
                setError("");
                setSuccess("");
              }}
            >
              Sign In
            </button>
            <button
              className={tab === "signup" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => {
                setTab("signup");
                setError("");
                setSuccess("");
              }}
            >
              Register Organization
            </button>
            <button
              className={tab === "forgot" ? styles.tabBtnActive : styles.tabBtn}
              onClick={() => {
                setTab("forgot");
                setError("");
                setSuccess("");
              }}
            >
              Reset Access
            </button>
          </div>

          {/* Demo Credentials Chip (Only in Demo Mode) */}
          {demoMode && (
            <div className={styles.demoChip}>
              <span className={styles.demoChipLabel}>DEMO ENVIRONMENT</span>
              <div className={styles.demoCreds}>operator@vaada.local / 123456789</div>
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
          )}

          {error && <div className={styles.formError}>{error}</div>}
          {success && <div className={styles.formSuccess}>{success}</div>}

          {/* SIGN IN FORM */}
          {tab === "signin" && (
            <form onSubmit={onSignIn} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Corporate Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="operator@company.com"
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Password</label>
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
                {loading ? "Authenticating..." : "Sign In to Workspace →"}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {tab === "signup" && (
            <form onSubmit={onSignUp} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Corporate Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  placeholder="admin@enterprise.com"
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Organization Name</label>
                <input
                  type="text"
                  value={tenantName}
                  onChange={(e) => setTenantName(e.target.value)}
                  placeholder="e.g. Acme Industries Pvt Ltd"
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Password (Min 10 characters with Aa1!)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Uppercase, lowercase, digit, symbol required"
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm Password</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  className={styles.formInput}
                />
              </div>

              <button type="submit" disabled={loading} className={styles.signInBtn}>
                {loading ? "Creating Organization Workspace..." : "Create Organization & Workspace →"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {tab === "forgot" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <form onSubmit={onForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Registered Corporate Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="account@company.com"
                    required
                    className={styles.formInput}
                  />
                </div>
                <button type="submit" disabled={loading} className={styles.signInBtn}>
                  {loading ? "Dispatching..." : "Send Reset Instructions"}
                </button>
              </form>

              {resetToken && (
                <form
                  onSubmit={onCompleteReset}
                  style={{
                    marginTop: 16,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border-subtle, #1e2430)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <span className={styles.formLabel} style={{ color: "var(--accent, #c4943a)" }}>
                    Apply Reset Token
                  </span>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Reset Token</label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      required
                      className={styles.formInput}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>New Password (Min 10 chars, Aa1!)</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={styles.formInput}
                    />
                  </div>
                  <button type="submit" disabled={loading} className={styles.signInBtn}>
                    {loading ? "Updating Password..." : "Update Password & Revoke Prior Sessions"}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Footer Security Badges */}
          <div className={styles.cardFooter}>
            <span>Argon2id Key Derivation</span>
            <span>·</span>
            <span>Immutable RFC 9562 UID</span>
            <span>·</span>
            <span>Zero-Trust Tenant Isolation</span>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0c0e12",
            color: "#94a3b8",
          }}
        >
          Loading authentication portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
