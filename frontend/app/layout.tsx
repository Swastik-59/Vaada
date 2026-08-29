import "./globals.css";
import type { ReactNode } from "react";
import { Big_Shoulders_Display, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

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
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata = {
  title: "Vaayda — recover the promise",
  description: "Bounded B2B revenue recovery for Indian merchants. Classify overdue invoices, extract Hinglish promises, enforce contact rules in code.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
