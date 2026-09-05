"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function QueueRedirectPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated && user?.uid) {
        router.replace(`/queue/${user.uid}`);
      } else {
        router.replace("/login?next=/queue");
      }
    }
  }, [loading, isAuthenticated, user, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0c0e12",
        color: "#94a3b8",
        fontFamily: "var(--font-sans, sans-serif)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "2px solid rgba(196, 148, 58, 0.2)",
          borderTopColor: "#c4943a",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginBottom: 16,
        }}
      />
      <span style={{ fontSize: "13px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
        Resolving Authorized Workspace...
      </span>
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
