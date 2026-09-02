"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function Preloader() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"intro" | "reveal" | "exit">("intro");

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
      setPhase("reveal");
    }, 400);

    const t2 = setTimeout(() => {
      setPhase("exit");
    }, 1200);

    const t3 = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("vaada_seal_passed", "1");
    }, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader-overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "var(--bg-deep)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            pointerEvents: phase === "exit" ? "none" : "auto",
          }}
        >
          {/* Elegant typographic brand moment */}
          <div style={{ overflow: "hidden" }}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={
                phase === "intro" 
                  ? { y: "100%", opacity: 0 } 
                  : phase === "reveal" 
                  ? { y: "0%", opacity: 1 } 
                  : { y: "-100%", opacity: 0 }
              }
              transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
              style={{
                fontFamily: "var(--display)",
                fontSize: "clamp(3rem, 10vw, 6rem)",
                fontWeight: 300,
                letterSpacing: "-0.02em",
                color: "var(--text-primary)",
                lineHeight: 1,
              }}
            >
              Vaada.
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
