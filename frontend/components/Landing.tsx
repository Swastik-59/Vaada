"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./landing.module.css";

const STEPS = [
  {
    n: "01",
    title: "Event in",
    copy: "An overdue invoice or failed collection hits an EventSource. Synthetic today. Razorpay test-mode later. Downstream never cares which.",
    owner: "INGEST",
  },
  {
    n: "02",
    title: "Cause, not vibes",
    copy: "Known decline codes map in a table. The model only sees leftover text. Every case records which tier decided.",
    owner: "CLASSIFY",
  },
  {
    n: "03",
    title: "Probability, classical",
    copy: "A tabular scorer — not a chat model — estimates recovery chance from cause, amount, age, and prior contacts.",
    owner: "SCORE",
  },
  {
    n: "04",
    title: "DAG, then stop",
    copy: "Next action is a graph: retry, remind, escalate, halt. Max attempts and human-threshold are edges, not suggestions.",
    owner: "ORCHESTRATE",
  },
  {
    n: "05",
    title: "वादा, structured",
    copy: "Hinglish replies become amount, date, confidence, language mix. Bad JSON retries, then human review. No guessed rupees.",
    owner: "EXTRACT",
  },
  {
    n: "06",
    title: "Guardrails fire",
    copy: "Contact window, frequency cap, tone, disclosure, identity. Fail one and the action cannot send. The rejection is logged.",
    owner: "COMPLY",
  },
  {
    n: "07",
    title: "Human owns the knife",
    copy: "Override is a first-class transfer of authority, not a hidden toggle. Audit writes who moved the case and why.",
    owner: "OVERRIDE",
  },
];

export default function Landing() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.from(".heroLetter", {
        yPercent: 110,
        rotate: 4,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.045,
      });
      gsap.from(".heroCopy", {
        y: 24,
        opacity: 0,
        duration: 0.8,
        delay: 0.35,
        ease: "power2.out",
        stagger: 0.08,
      });
      gsap.utils.toArray<HTMLElement>(".stepRow").forEach((row) => {
        gsap.from(row, {
          x: -28,
          opacity: 0,
          duration: 0.55,
          ease: "power2.out",
          scrollTrigger: { trigger: row, start: "top 86%" },
        });
      });
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((block) => {
        gsap.from(block, {
          y: 36,
          opacity: 0,
          duration: 0.7,
          ease: "power2.out",
          scrollTrigger: { trigger: block, start: "top 80%" },
        });
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <main ref={root} className={styles.site}>
      <header className={styles.nav}>
        <span className={styles.mark}>वादा / PROMISE</span>
        <span className={styles.navCenter}>Revenue recovery · B2B · India</span>
        <nav className={styles.navLinks}>
          <a href="#machine">Machine</a>
          <a href="#rules">Rules</a>
          <Link href="/login">Console</Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.spine}>
          <span>NOT CARD RETRY</span>
          <span>NOT DUNNING EMAIL</span>
          <span>NOT A CHATBOT WITH A QUEUE</span>
        </div>
        <div className={styles.heroBody}>
          <div className={`${styles.kicker} heroCopy`}>
            <span>Track 3 · AI revenue recovery</span>
            <span>Local LLM · classical score · executable FPC</span>
          </div>
          <h1 className={styles.wordmark} aria-label="Vaada">
            {"VAADA".split("").map((letter, idx) => (
              <span key={`${letter}-${idx}`} className="heroLetter">{letter}</span>
            ))}
          </h1>
          <div className={styles.subgrid}>
            <p className={`${styles.thesis} heroCopy`}>
              Recover overdue B2B invoices by turning a messy Hinglish promise into a dated, capped, auditable commitment.
            </p>
            <aside className={`${styles.stamp} heroCopy`}>
              <strong>STAMP</strong>
              Consumer smart-retry is already shipped by the rails. Western AR tools still type promises in after a call.
              Vaada extracts the वादा from the language Indian merchants actually get — then refuses to act if the rulebook says no.
            </aside>
          </div>
          <div className={`${styles.ctaRow} heroCopy`}>
            <Link className={styles.cta} href="/login">Open the console</Link>
            <a className={`${styles.cta} ${styles.ghost}`} href="#machine">See the machine</a>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span>01 / SPLIT</span>
          <span>The gap this exists to occupy</span>
          <span>B2B receivables</span>
        </div>
        <div className={styles.split}>
          <article className={`${styles.panel} reveal`}>
            <h2>They paid late. You still do not know why.</h2>
            <p>
              Mandate failed. Funds short. Invoice mismatch. Someone on WhatsApp wrote “kal 4 baje clear kar denge 1.8L”.
              That sentence is the asset. Most tools leave it as a note.
            </p>
          </article>
          <article className={`${styles.panel} reveal`}>
            <h2>A promise is a contract-shaped object.</h2>
            <ul>
              <li>Amount, date, confidence, language mix — schema or it did not happen.</li>
              <li>Contact only inside the window. Cap the rolling week. Identify the sender.</li>
              <li>Never disclose the debt to a third party. Wrong-number is a test, not a story.</li>
            </ul>
          </article>
        </div>
      </section>

      <section id="machine" className={styles.section}>
        <div className={styles.sectionHead}>
          <span>02 / MACHINE</span>
          <span>Seven stations. LLM sits in two of them. It owns none.</span>
          <span>Deterministic spine</span>
        </div>
        <div className={styles.tape}>
          {STEPS.map((step) => (
            <article key={step.n} className={`${styles.step} stepRow`}>
              <div className={styles.index}>{step.n}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
              <div className={styles.owner}>{step.owner}</div>
            </article>
          ))}
        </div>
      </section>

      <section id="rules" className={styles.section}>
        <div className={styles.sectionHead}>
          <span>03 / LEDGER</span>
          <span>Guardrails are code. A failed check is a stop, not a warning toast.</span>
          <span>RBI-aware controls</span>
        </div>
        <table className={styles.ledger}>
          <thead>
            <tr>
              <th>Check</th>
              <th>If it fails</th>
              <th>Status in product</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Contact window (08:00–19:00 local)</td>
              <td>Outbound blocked; next legal slot recorded</td>
              <td className={styles.pass}>ENFORCED</td>
            </tr>
            <tr>
              <td>Rolling frequency cap</td>
              <td>Escalate to human, do not nag</td>
              <td className={styles.pass}>ENFORCED</td>
            </tr>
            <tr>
              <td>Identity on every outbound template</td>
              <td>Message cannot be marked sendable</td>
              <td className={styles.pass}>ENFORCED</td>
            </tr>
            <tr>
              <td>Tone / disclosure</td>
              <td>LLM draft discarded; case stays in review</td>
              <td className={styles.warn}>PARTIAL — tone judge needs local model</td>
            </tr>
            <tr>
              <td>Razorpay live webhooks</td>
              <td>—</td>
              <td className={styles.fail}>NOT BUILT · adapter reserved</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className={styles.footer}>
        <h2 className="reveal">Stop pretending a reminder is recovery.</h2>
        <div className={styles.footerAside}>
          <p>
            The console is live for operators. The public page does not invent recovered rupees.
            Sign in, ingest a synthetic event, read the trace.
          </p>
          <Link className={styles.cta} href="/login">Enter operations</Link>
          <p className={styles.note}>
            Local demo credentials live in the repository-root .env after seed.
            Do not use them in production. Do not present synthetic Northwind invoices as a live merchant book.
          </p>
        </div>
      </footer>
    </main>
  );
}
