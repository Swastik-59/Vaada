import "./globals.css";
import type { ReactNode } from "react";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import Preloader from "@/components/Preloader";
import SmoothScrollProvider from "@/components/SmoothScroll";
import PageTransitionProvider from "@/components/PageTransition";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "Vaada — Bounded B2B Revenue Recovery for Indian Enterprises",
  description:
    "Turn informal B2B commitments into legally binding financial recoveries. Automated Razorpay failure intelligence, code-mixed Hinglish promise extraction, and MSME Section 43B(h) statutory clocks in code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Preloader />
        <SmoothScrollProvider>
          <PageTransitionProvider>
            {children}
          </PageTransitionProvider>
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
