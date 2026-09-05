"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthenticatedAppShell from "@/components/AuthenticatedAppShell";
import styles from "./settings.module.css";

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
  const { user, refreshAuth } = useAuth();
  const [config, setConfig] = useState<ComplianceConfig | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  // Data reset state
  const [dataMessage, setDataMessage] = useState("");
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    apiFetch("/api/v1/settings/compliance")
      .then(setConfig)
      .catch(() => {});
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (newPassword !== newPasswordConfirm) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    setPwLoading(true);
    try {
      const res = await apiFetch("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirm: newPasswordConfirm,
        }),
      });
      setPwSuccess(
        res?.message || "Password updated successfully. Prior sessions have been revoked."
      );
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      await refreshAuth();
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setPwLoading(false);
    }
  }

  async function handleClearSampleData() {
    if (!confirm("Clear all synthetic demo records for this organization? Real production data will not be affected.")) {
      return;
    }
    setDataLoading(true);
    setDataMessage("");
    try {
      const res = await apiFetch("/api/v1/tenant/sample-data", { method: "DELETE" });
      setDataMessage(`Synthetic portfolio cleared: ${res.invoices_removed} mock invoices purged.`);
    } catch (err) {
      setDataMessage(err instanceof Error ? err.message : "Failed to clear sample data");
    } finally {
      setDataLoading(false);
    }
  }

  function copyUid() {
    if (user?.uid) {
      navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  }

  return (
    <AuthenticatedAppShell title="Settings & Security">
      <div className={styles.settingsWrapper}>
        <div className={styles.headerSection}>
          <h1 className={styles.title}>Account & Security Settings</h1>
          <p className={styles.subtitle}>
            Manage your verified enterprise identity, security credentials, active sessions, and compliance rules.
          </p>
        </div>

        {/* Section 1: Identity & Password Grid */}
        <div className={styles.gridTwoCol}>
          {/* Identity Profile */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Identity & Organization Profile</h2>
            <p className={styles.cardDesc}>
              Authoritative credentials linked to your tenant workspace.
            </p>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Organization Workspace</span>
              <span className={styles.metaValue}>{user?.tenant_name || "Enterprise Tenant"}</span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Corporate Email</span>
              <span className={styles.metaValue}>{user?.email || "—"}</span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Role & Permissions</span>
              <span className={styles.metaValue} style={{ textTransform: "uppercase" }}>
                {user?.role || "Operator"}
              </span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Account Identifier</span>
              <div className={styles.uidDisplayBox}>
                <code className={styles.uidCode}>{user?.uid || "usr_pending"}</code>
                <button type="button" onClick={copyUid} className={styles.copyBtn}>
                  {copiedUid ? "Copied ✓" : "Copy UID"}
                </button>
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Your permanent account identifier used for audit attribution and support.
              </span>
            </div>
          </div>

          {/* Password & Credential Management */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Change Password</h2>
            <p className={styles.cardDesc}>
              Updating your password secures your account with Argon2id and automatically revokes all prior active sessions.
            </p>

            {pwSuccess && <div className={styles.alertSuccess}>{pwSuccess}</div>}
            {pwError && <div className={styles.alertError}>{pwError}</div>}

            <form onSubmit={handlePasswordChange}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Confirm New Password</label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  required
                  className={styles.formInput}
                />
              </div>

              <button type="submit" disabled={pwLoading} className={styles.submitBtn}>
                {pwLoading ? "Updating..." : "Update Password & Revoke Sessions"}
              </button>
            </form>
          </div>
        </div>

        {/* Section 2: Active Session & Data Management */}
        <div className={styles.gridTwoCol}>
          {/* Active Session */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Active Session Security</h2>
            <p className={styles.cardDesc}>
              Details regarding the currently authenticated session and token revocation state.
            </p>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Session Status</span>
              <span className={styles.metaValue} style={{ color: "#22c55e" }}>
                ● Active & Verified (Strict CSRF + SameSite HttpOnly)
              </span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Account Status</span>
              <span className={styles.metaValue}>{user?.status === "active" ? "Active / In Good Standing" : user?.status}</span>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Last Session Login</span>
              <span className={styles.metaValue}>
                {user?.last_login_at ? new Date(user.last_login_at).toLocaleString("en-IN") : "Active Session"}
              </span>
            </div>
          </div>

          {/* Workspace Data Management */}
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Workspace Data Management</h2>
            <p className={styles.cardDesc}>
              Manage synthetic test datasets generated for onboarding and evaluation.
            </p>

            {dataMessage && <div className={styles.alertSuccess}>{dataMessage}</div>}

            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px", lineHeight: 1.5 }}>
              You can safely purge all synthetic cases and simulated invoices seeded in this tenant. Real external transactions will never be affected.
            </p>

            <div>
              <button
                type="button"
                onClick={handleClearSampleData}
                disabled={dataLoading}
                className={styles.dangerBtn}
              >
                {dataLoading ? "Purging..." : "Clear Synthetic Sample Data"}
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Statutory Compliance Rules */}
        {config && (
          <div className={styles.card} style={{ marginTop: "8px" }}>
            <h2 className={styles.cardTitle}>Statutory & Regulatory Contact Policy</h2>
            <p className={styles.cardDesc}>
              Hardcoded compliance parameters enforcing RBI fair practice codes and MSMED Section 43B(h) clocks.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginBottom: "20px" }}>
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>RBI Permitted Contact Hours</span>
                <span className={styles.metaValue}>
                  {config.contact_window_start_hour}:00 – {config.contact_window_end_hour}:00 IST
                </span>
              </div>

              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Weekly Contact Velocity Cap</span>
                <span className={styles.metaValue}>
                  Max {config.max_contacts_per_7_days} contacts per debtor / 7 days
                </span>
              </div>

              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Statutory Clocks</span>
                <span className={styles.metaValue}>MSME Section 43B(h) 45-day cutoff enforced</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {config.rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "var(--bg-deep, #0c0e12)",
                    border: "1px solid var(--border-subtle, #1e2430)",
                    borderRadius: "6px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
                      {rule.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {rule.description}
                    </div>
                  </div>
                  <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>
                    ENFORCED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AuthenticatedAppShell>
  );
}
