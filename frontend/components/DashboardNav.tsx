"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, UserProfile } from "@/context/AuthContext";
import styles from "./dashboard-nav.module.css";

interface DashboardNavProps {
  title?: string;
  user?: UserProfile | null;
}

export default function DashboardNav({ title, user: propUser }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeUser = propUser !== undefined ? propUser : authUser;
  const canonicalQueueHref = activeUser?.uid ? `/queue/${activeUser.uid}` : "/queue";

  const DASHBOARD_TABS = [
    { href: canonicalQueueHref, label: "Recovery Queue", matchPrefix: "/queue" },
    { href: "/cfo", label: "CFO Suite", matchPrefix: "/cfo" },
    { href: "/analytics", label: "Analytics", matchPrefix: "/analytics" },
    { href: "/audit", label: "Audit Trail", matchPrefix: "/audit" },
    { href: "/razorpay-taxonomy", label: "Gateway Taxonomy", matchPrefix: "/razorpay-taxonomy" },
    { href: "/settings", label: "Settings & Security", matchPrefix: "/settings" },
  ];

  async function handleSignOut() {
    await logout();
    router.push("/login");
  }

  // Derive title from active tab if not passed
  let derivedTitle = title;
  if (!derivedTitle) {
    if (pathname.startsWith("/queue") || pathname.startsWith("/cases")) {
      derivedTitle = pathname.startsWith("/cases") ? "Case Dossier" : "Recovery Queue";
    } else if (pathname.startsWith("/cfo")) {
      derivedTitle = "CFO Executive Suite";
    } else if (pathname.startsWith("/analytics")) {
      derivedTitle = "Portfolio Analytics";
    } else if (pathname.startsWith("/audit")) {
      derivedTitle = "Immutable Audit Trail";
    } else if (pathname.startsWith("/settings")) {
      derivedTitle = "Settings & Security";
    } else if (pathname.startsWith("/razorpay-taxonomy")) {
      derivedTitle = "Gateway Error Taxonomy";
    } else {
      derivedTitle = "Workspace";
    }
  }

  return (
    <>
      <nav className={styles.topBar}>
        <div className={styles.barLeft}>
          <Link href="/" className={styles.brandMark} title="Return to Home">
            <span>VAADA</span>
            <span className={styles.brandDevanagari}>वादा</span>
          </Link>
          <span className={styles.barDivider}>/</span>
          <span className={styles.barTitle} title={activeUser?.tenant_name || derivedTitle}>
            {activeUser?.tenant_name ? `${activeUser.tenant_name}` : derivedTitle}
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <div className={styles.barCenter}>
          {DASHBOARD_TABS.map((tab) => {
            const isActive =
              (tab.matchPrefix === "/queue" && (pathname.startsWith("/queue") || pathname.startsWith("/cases"))) ||
              (tab.matchPrefix !== "/queue" && pathname.startsWith(tab.matchPrefix));

            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={isActive ? styles.barNavLinkActive : styles.barNavLink}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className={styles.barRight}>
          {activeUser ? (
            <div className={styles.userProfilePill}>
              <span className={styles.userDot} />
              <span className={styles.userEmail} title={activeUser.email}>{activeUser.email}</span>
              <span className={styles.userRoleTag}>{activeUser.role}</span>
              <button
                onClick={handleSignOut}
                className={styles.signOutBtn}
                title="Sign Out of Session"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/login" className={styles.signInLink}>
              Sign In
            </Link>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            className={styles.mobileMenuToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className={styles.mobileDrawer}>
          {DASHBOARD_TABS.map((tab) => {
            const isActive =
              (tab.matchPrefix === "/queue" && (pathname.startsWith("/queue") || pathname.startsWith("/cases"))) ||
              (tab.matchPrefix !== "/queue" && pathname.startsWith(tab.matchPrefix));

            return (
              <Link
                key={tab.label}
                href={tab.href}
                className={isActive ? styles.mobileNavLinkActive : styles.mobileNavLink}
                onClick={() => setMobileOpen(false)}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
