import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { SpeedInsights } from "@vercel/speed-insights/next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

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
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before first paint to avoid flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('theme');if(s==='light'||s==='dark'){document.documentElement.dataset.theme=s;}else if(!window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
