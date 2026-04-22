import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://professionos.com"),
  title: "Profession OS",
  description:
    "Professional dashboard for monitoring services, mailboxes, calendars, and alerts with an agentic AI assistant.",
  openGraph: {
    title: "Profession OS",
    description:
      "One OS for your entire professional life. Mail · Calendar · Code · CRM — monitored by AI, surfaced in one agentic command center.",
    url: "https://professionos.com",
    siteName: "Profession OS",
    images: [
      {
        url: "/brand/og-card.png",
        width: 1200,
        height: 630,
        alt: "Profession OS — Command Center",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Profession OS",
    description:
      "One OS for your entire professional life. Mail · Calendar · Code · CRM — monitored by AI.",
    images: ["/brand/og-card.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
