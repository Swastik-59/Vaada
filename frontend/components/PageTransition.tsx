"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";

export default function PageTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
