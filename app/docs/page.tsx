import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Docs — Profession OS",
  description: "Documentation for Profession OS. Guides, references, and API docs coming soon.",
};

export default function DocsPage() {
  return (
    <div className={styles.page}>
      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="/" className={styles.navBrand} aria-label="Profession OS">
            <Image src="/brand/logo.svg" alt="Profession OS" width={140} height={28} priority />
          </a>
          <ul className={styles.navLinks} role="list">
            <li><a href="/#features" className={styles.navLink}>Features</a></li>
            <li><a href="/#pricing" className={styles.navLink}>Pricing</a></li>
            <li><a href="/docs" className={`${styles.navLink} ${styles.navLinkActive}`}>Docs</a></li>
            <li><a href="/blog" className={styles.navLink}>Blog</a></li>
          </ul>
          <div className={styles.navActions}>
            <a href="https://app.professionos.com" className={styles.navLinkSecondary}>Sign in</a>
            <a href="/sign-up" className={styles.navCta}>Get Started</a>
          </div>
        </div>
      </nav>

      {/* ── Coming soon ──────────────────────────────────────────── */}
      <main className={styles.main}>
        <div className={styles.comingSoon}>
          <span className={styles.eyebrow}>Documentation</span>
          <h1 className={styles.title}>Docs coming soon.</h1>
          <p className={styles.subtitle}>
            We&apos;re writing comprehensive guides, API references, and tutorials.<br />
            Check back shortly — or get notified when we launch.
          </p>
          <a href="/sign-up" className={styles.cta}>Get notified →</a>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <a href="/" className={styles.footerBrand} aria-label="Profession OS">
            <Image src="/brand/logo.svg" alt="Profession OS" width={110} height={22} />
          </a>
          <p className={styles.footerCopy}>© 2026 Profession OS. All rights reserved.</p>
          <nav className={styles.footerLinks} aria-label="Footer">
            <a href="/#features">Features</a>
            <a href="/#pricing">Pricing</a>
            <a href="/docs">Docs</a>
            <a href="/blog">Blog</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
