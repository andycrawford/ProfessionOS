import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
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
        {/* Runs before first paint to avoid flash of wrong theme/panel styles */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=localStorage.getItem('theme');if(s==='light'||s==='dark'){document.documentElement.dataset.theme=s;}else if(!window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.dataset.theme='light';}try{var u=localStorage.getItem('uiPreferences');if(u){var p=JSON.parse(u),el=document.documentElement,th=el.dataset.theme||'dark';if(p.panels){var h=p.panels.tintColor||(th==='dark'?'#161A1F':'#FFFFFF'),op=typeof p.panels.opacity==='number'?p.panels.opacity:1,r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);el.style.setProperty('--panel-bg','rgba('+r+','+g+','+b+','+op+')');el.style.setProperty('--chrome-bg','rgba('+r+','+g+','+b+','+Math.min(op*2,1)+')');el.style.setProperty('--panel-blur',(p.panels.blur||0)+'px');}if(p.background&&p.background.type==='preset'&&p.background.presetKey){el.style.setProperty('--bg-image','url(/wallpapers/'+p.background.presetKey+'.svg)');}}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
