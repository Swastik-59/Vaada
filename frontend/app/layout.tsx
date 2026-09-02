import "./globals.css";
import type { ReactNode } from "react";
import { Big_Shoulders_Display, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Preloader from "@/components/Preloader";
import SmoothScrollProvider from "@/components/SmoothScroll";
import PageTransitionProvider from "@/components/PageTransition";

const display = Big_Shoulders_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-display",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Vaada — Bounded B2B Revenue Recovery for Indian Enterprises",
  description: "Enterprise revenue recovery for Indian merchants and MSMEs. Classify overdue invoices with official Razorpay taxonomy, extract Hinglish promises, enforce statutory compliance in code.",
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
