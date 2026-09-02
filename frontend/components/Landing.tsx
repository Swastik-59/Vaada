"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import styles from "./landing.module.css";

export default function Landing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // State 1: Failed (0 - 0.25)
  const opacity1 = useTransform(scrollYProgress, [0, 0.15, 0.25], [1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0, 0.25], [0, -50]);

  // State 2: Understood (0.25 - 0.5)
  const opacity2 = useTransform(scrollYProgress, [0.2, 0.35, 0.45, 0.5], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.2, 0.35, 0.5], [50, 0, -50]);

  // State 3: Promising (0.5 - 0.75)
  const opacity3 = useTransform(scrollYProgress, [0.45, 0.6, 0.7, 0.75], [0, 1, 1, 0]);
  const y3 = useTransform(scrollYProgress, [0.45, 0.6, 0.75], [50, 0, -50]);

  // State 4: Recovered (0.75 - 1)
  const opacity4 = useTransform(scrollYProgress, [0.7, 0.85, 1], [0, 1, 1]);
  const y4 = useTransform(scrollYProgress, [0.7, 0.85, 1], [50, 0, 0]);

  return (
    <main className={styles.site}>
      {/* ── Minimal Masthead ── */}
      <header className={styles.masthead}>
        <div className={styles.brandMark}>Vaada.</div>
        <nav className={styles.mastheadNav}>
          <Link href="/login" className={styles.consoleLink}>
            Operations Console
          </Link>
        </nav>
      </header>

      {/* ── Hero Editorial Moment ── */}
      <section className={styles.hero}>
        <motion.h1
          className={styles.heroHeadline}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1], delay: 1 }}
        >
          Recover Revenue Without Losing Trust.
        </motion.h1>
        <motion.p
          className={styles.heroSub}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
        >
          Transforming informal B2B promises into structured, legally compliant financial reality.
        </motion.p>
        <motion.div 
          className={styles.scrollHint}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
        >
          <span>Scroll to observe</span>
          <div className={styles.scrollLine} />
        </motion.div>
      </section>

      {/* ── The Cinematic Pipeline ── */}
      <section ref={containerRef} className={styles.pipelineSection}>
        <div className={styles.pipelineSticky}>
          <div className={styles.invoiceObject}>
            {/* State 1 */}
            <motion.div style={{ opacity: opacity1, y: y1 }} className={styles.stageText}>
              "Payment failed. Code: BAD_REQUEST"
              <div className={styles.stageCaption}>The raw, unhelpful reality of Razorpay declines.</div>
            </motion.div>

            {/* State 2 */}
            <motion.div style={{ opacity: opacity2, y: y2 }} className={styles.stageText}>
              "Kal shaam 4 baje 1.8L RTGS kar denge pakka."
              <div className={styles.stageCaption}>The human truth hidden in WhatsApp.</div>
            </motion.div>

            {/* State 3 */}
            <motion.div style={{ opacity: opacity3, y: y3 }} className={styles.stageText}>
              ₹1,80,000.00 @ Friday 16:00 IST
              <div className={styles.stageCaption}>Structured, legally bound, and continuously enforced.</div>
            </motion.div>

            {/* State 4 */}
            <motion.div style={{ opacity: opacity4, y: y4 }} className={styles.stageText}>
              Ledger Reconciled.
              <div className={styles.stageCaption}>Section 43B(h) Risk Extinguished.</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Institutional Footer ── */}
      <footer className={styles.footer}>
        <h2 className={styles.footerHeadline}>
          Stop pretending automated nag-emails are revenue recovery.
        </h2>
        <Link href="/login" className={styles.footerCta}>
          Enter the Operator Console
        </Link>
      </footer>
    </main>
  );
}
