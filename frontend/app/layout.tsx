import "./globals.css";
import type { ReactNode } from "react";
import { DM_Sans, Inter, JetBrains_Mono, Noto_Serif_Devanagari } from "next/font/google";
import Preloader from "@/components/Preloader";
import SmoothScrollProvider from "@/components/SmoothScroll";
import PageTransitionProvider from "@/components/PageTransition";

const display = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

const devanagari = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  weight: ["600"],
});

export const metadata = {
  title: "Vaada — Bounded B2B Revenue Recovery for Indian Enterprises",
  description:
    "Turn informal B2B commitments into legally binding financial recoveries. Automated Razorpay failure intelligence, code-mixed Hinglish promise extraction, and MSME Section 43B(h) statutory clocks in code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${devanagari.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const now = new Date();
                  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
                  const istDate = new Date(istString);
                  const hour = istDate.getHours();
                  if (hour >= 9 && hour < 20) {
                    document.documentElement.classList.add("window-open");
                  } else {
                    document.documentElement.classList.add("window-closed");
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
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
