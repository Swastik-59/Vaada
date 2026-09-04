"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import styles from "./dashboard-nav.module.css";

interface UserProfile {
  email: string;
  role: string;
}

interface DashboardNavProps {
  title?: string;
  user?: UserProfile | null;
}

const DASHBOARD_TABS = [
  { href: "/queue", label: "Operations Console", matchPrefix: "/queue" },
  { href: "/cfo", label: "CFO Executive Suite", matchPrefix: "/cfo" },
  { href: "/analytics", label: "Portfolio Analytics", matchPrefix: "/analytics" },
  { href: "/audit", label: "Audit Trail", matchPrefix: "/audit" },
  { href: "/settings", label: "Compliance Rules", matchPrefix: "/settings" },
  { href: "/razorpay-taxonomy", label: "Gateway Taxonomy", matchPrefix: "/razorpay-taxonomy" },
];

export default function DashboardNav({ title, user: initialUser }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(initialUser ?? null);

  useEffect(() => {
    if (initialUser !== undefined) {
      setUser(initialUser);
      return;
    }

    apiFetch("/api/v1/auth/me")
      .then((res) => {
        if (res?.user) setUser(res.user);
      })
      .catch(() => {
        setUser(null);
      });
  }, [initialUser]);

  async function handleSignOut() {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Ignore network failure on logout
    }
    router.push("/login");
  }

  // Derive title from active tab if not passed
  let derivedTitle = title;
  if (!derivedTitle) {
    if (pathname.startsWith("/queue") || pathname.startsWith("/cases")) {
      derivedTitle = pathname.startsWith("/cases") ? "Case Dossier" : "Operations Console";
    } else if (pathname.startsWith("/cfo")) {
      derivedTitle = "CFO Executive Suite";
    } else if (pathname.startsWith("/analytics")) {
      derivedTitle = "Institutional Analytics";
    } else if (pathname.startsWith("/audit")) {
      derivedTitle = "Audit Trail";
    } else if (pathname.startsWith("/settings")) {
      derivedTitle = "Compliance Rules";
    } else if (pathname.startsWith("/razorpay-taxonomy")) {
      derivedTitle = "Gateway Taxonomy";
    } else {
      derivedTitle = "Dashboard";
    }
  }

  return (
    <nav className={styles.topBar}>
      <div className={styles.barLeft}>
        <Link href="/" className={styles.brandMark} title="Return to Home">
          <span>VAADA</span>
          <span className={styles.brandDevanagari}>वादा</span>
        </Link>
        <span className={styles.barDivider}>/</span>
        <span className={styles.barTitle}>{derivedTitle}</span>
      </div>

      <div className={styles.barCenter}>
        {DASHBOARD_TABS.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.matchPrefix !== "/queue" && pathname.startsWith(tab.matchPrefix)) ||
            (tab.matchPrefix === "/queue" && (pathname === "/queue" || pathname.startsWith("/cases")));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={isActive ? styles.barNavLinkActive : styles.barNavLink}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className={styles.barRight}>
        {user ? (
          <div className={styles.userProfilePill}>
            <span className={styles.userDot} />
            <span className={styles.userEmail}>{user.email}</span>
            <span className={styles.userRoleTag}>{user.role}</span>
            <button
              onClick={handleSignOut}
              className={styles.signOutBtn}
              title="Sign Out"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <Link href="/login" className={styles.signInLink}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
