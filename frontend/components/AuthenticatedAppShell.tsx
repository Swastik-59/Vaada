"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import DashboardNav from "@/components/DashboardNav";
import styles from "./authenticated-app-shell.module.css";

interface AuthenticatedAppShellProps {
  children: React.ReactNode;
  expectedUid?: string;
  title?: string;
}

export default function AuthenticatedAppShell({
  children,
  expectedUid,
  title,
}: AuthenticatedAppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Immediate redirect to login preserving destination
      const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${nextParam}`);
    }
  }, [loading, isAuthenticated, pathname, router]);

  // 1. Loading state
  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <span className={styles.loadingText}>Verifying Session Authority...</span>
      </div>
    );
  }

  // 2. Unauthenticated: prevent any in-page content flash while redirect occurs
  if (!isAuthenticated || !user) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <span className={styles.loadingText}>Redirecting to Sign In...</span>
      </div>
    );
  }

  // 3. Expected UID verification (Security against cross-user workspace access)
  if (expectedUid && expectedUid !== user.uid) {
    return (
      <div className={styles.shellContainer}>
        <DashboardNav title="Access Denied" />
        <main className={styles.forbiddenContainer}>
          <div className={styles.forbiddenCard}>
            <span className={styles.forbiddenBadge}>403 · Cross-Workspace Forbidden</span>
            <h2 className={styles.forbiddenTitle}>Unauthorized Workspace Context</h2>
            <p className={styles.forbiddenDesc}>
              The requested workspace identifier does not match your authenticated credentials.
              Server-side authorization is strictly enforced based on your verified session principal.
            </p>
            <Link href={`/queue/${user.uid}`} className={styles.forbiddenActionBtn}>
              Return to Your Authorized Workspace →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // 4. Authenticated & Authorized workspace
  return (
    <div className={styles.shellContainer}>
      <DashboardNav title={title} />
      <main className={styles.shellMain}>{children}</main>
    </div>
  );
}
