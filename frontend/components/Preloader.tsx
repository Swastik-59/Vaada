"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function Preloader() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"calibrating" | "verified" | "opening">("calibrating");

  useEffect(() => {
    // Check if previously seen in this session
    const seen = sessionStorage.getItem("vaada_seal_passed");
    if (seen) {
      return;
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      sessionStorage.setItem("vaada_seal_passed", "1");
      return;
    }

    setVisible(true);

    const t1 = setTimeout(() => {
      setPhase("verified");
    }, 600);

    const t2 = setTimeout(() => {
      setPhase("opening");
    }, 1100);

    const t3 = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("vaada_seal_passed", "1");
    }, 1600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem("vaada_seal_passed", "1");
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
          onClick={dismiss}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "var(--bg-deep)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {/* Top and bottom architectural shutter plates */}
          <motion.div
            initial={{ scaleY: 1 }}
            animate={phase === "opening" ? { y: "-100%" } : { y: 0 }}
            transition={{ duration: 0.6, ease: [0.85, 0, 0.15, 1] }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "50%",
              backgroundColor: "var(--bg-deep)",
              borderBottom: "1px solid var(--border-strong)",
              zIndex: 1,
            }}
          />
          <motion.div
            initial={{ scaleY: 1 }}
            animate={phase === "opening" ? { y: "100%" } : { y: 0 }}
            transition={{ duration: 0.6, ease: [0.85, 0, 0.15, 1] }}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "50%",
              backgroundColor: "var(--bg-deep)",
              borderTop: "1px solid var(--border-strong)",
              zIndex: 1,
            }}
          />

          {/* Central Seal Container */}
          <div
            style={{
              position: "relative",
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              padding: "36px 48px",
              border: "1px solid var(--border-strong)",
              backgroundColor: "rgba(15, 17, 20, 0.95)",
              maxWidth: 580,
              width: "90%",
              boxShadow: "0 24px 48px rgba(0,0,0,0.8)",
            }}
          >
            {/* Top registration marks */}
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--mono)",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--text-muted)",
              }}
            >
              <span>SYS // ARMED</span>
              <span>IST 08:00–19:00</span>
              <span>REF 43B(H)</span>
            </div>

            {/* Wordmark */}
            <div style={{ textAlign: "center", margin: "10px 0" }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                style={{
                  fontFamily: "var(--display)",
                  fontSize: "clamp(2.8rem, 8vw, 4.5rem)",
                  fontWeight: 900,
                  letterSpacing: "0.02em",
                  lineHeight: 0.85,
                  textTransform: "uppercase",
                  color: "var(--text-primary)",
                }}
              >
                VAADA <span style={{ color: "var(--accent)" }}>/</span> वादा
              </motion.div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "var(--text-secondary)",
                  marginTop: 8,
                }}
              >
                Bounded B2B Revenue Recovery
              </div>
            </div>

            {/* Calibration Telemetry Progress */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: "var(--mono)",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: phase === "verified" ? "var(--color-recovered)" : "var(--color-warning)",
                }}
              >
                <span>
                  {phase === "calibrating"
                    ? "CALIBRATING DETERMINISTIC RECOVERY ENGINE…"
                    : "✓ TAXONOMY & RBI GUARDRAILS VERIFIED"}
                </span>
                <span>{phase === "calibrating" ? "42/42 RAILS" : "READY"}</span>
              </div>
              <div
                style={{
                  height: 3,
                  width: "100%",
                  backgroundColor: "var(--border-subtle)",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <motion.div
                  initial={{ width: "12%" }}
                  animate={{ width: phase === "calibrating" ? "75%" : "100%" }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                  style={{
                    height: "100%",
                    backgroundColor: phase === "verified" ? "var(--color-recovered)" : "var(--accent)",
                  }}
                />
              </div>
            </div>

            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                letterSpacing: "0.15em",
                color: "var(--text-muted)",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              Click anywhere to advance
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
