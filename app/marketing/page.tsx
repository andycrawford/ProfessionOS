import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Profession OS — Every signal. One surface.",
  description:
    "AI-powered command center for high-output professionals. Mail · Calendar · Code · CRM — monitored by AI, surfaced in one agentic command center.",
};

export default function MarketingPage() {
  return (
    <div className={styles.page}>
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <a href="/" className={styles.navBrand} aria-label="Profession OS">
            <Image
              src="/brand/logo.svg"
              alt="Profession OS"
              width={140}
              height={28}
              priority
            />
          </a>

          <ul className={styles.navLinks} role="list">
            <li><a href="#features" className={styles.navLink}>Features</a></li>
            <li><a href="#pricing" className={styles.navLink}>Pricing</a></li>
            <li><a href="/docs" className={styles.navLink}>Docs</a></li>
            <li><a href="/blog" className={styles.navLink}>Blog</a></li>
          </ul>

          <div className={styles.navActions}>
            <a href="https://app.professionos.com" className={styles.navLinkSecondary}>Sign in</a>
            <a href="/sign-up" className={styles.navCta}>Get Started</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <main className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.eyebrow}>
            <span>Your Command Center</span>
          </div>

          <h1 className={styles.headline}>
            One OS for your entire professional{" "}
            <span className={styles.headlineAccent}>
              life.<span className={styles.cursor} aria-hidden="true" />
            </span>
          </h1>

          <p className={styles.subheadline}>
            Mail · Calendar · Code · CRM — monitored by AI,
            <br />
            surfaced in one agentic command center.
          </p>

          <div className={styles.ctaRow}>
            <a href="/sign-up" className={styles.ctaPrimary}>Start free →</a>
            <a href="https://demo.professionos.com" className={styles.ctaSecondary}>View demo</a>
          </div>

          <p className={styles.socialProof}>Used by professionals at</p>
          <div className={styles.logoRow} aria-hidden="true">
            <span className={styles.logoPill} />
            <span className={styles.logoPill} />
            <span className={styles.logoPill} />
            <span className={styles.logoPill} />
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.appPreview} aria-hidden="true">
            <div className={styles.previewTitlebar}>
              <span className={styles.windowDot} data-color="red" />
              <span className={styles.windowDot} data-color="yellow" />
              <span className={styles.windowDot} data-color="green" />
              <span className={styles.previewUrl}>app.professionos.com — Command Center</span>
            </div>

            {/* Topbar mockup */}
            <div className={styles.previewTopbar}>
              <span className={styles.previewLogoBlock} />
              <span className={styles.previewCtaBlock} />
            </div>

            {/* Alert bar */}
            <div className={styles.previewAlertbar}>
              <span className={styles.previewAlertDot} />
              <span className={styles.previewAlertText} />
            </div>

            {/* Body */}
            <div className={styles.previewBody}>
              {/* Nav rail */}
              <div className={styles.previewNavRail}>
                <span className={styles.previewNavItem} data-active="true" />
                <span className={styles.previewNavItem} />
                <span className={styles.previewNavItem} />
                <span className={styles.previewNavItem} />
              </div>

              {/* Content */}
              <div className={styles.previewContent}>
                {/* Widget row */}
                <div className={styles.previewWidgets}>
                  {[
                    { label: "EMAIL", value: "124", delta: "↑ 18%", status: "up" },
                    { label: "CALENDAR", value: "12", delta: "⚠ 3", status: "warn" },
                    { label: "SLACK", value: "248", delta: "↓ 5%", status: "down" },
                    { label: "CODE", value: "11", delta: "↑ 22%", status: "up" },
                    { label: "CRM", value: "5", delta: "—", status: "neutral" },
                  ].map((w) => (
                    <div key={w.label} className={styles.previewWidget}>
                      <span className={styles.previewWidgetLabel}>{w.label}</span>
                      <span className={styles.previewWidgetValue}>{w.value}</span>
                      <span className={styles.previewWidgetDelta} data-status={w.status}>{w.delta}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom row */}
                <div className={styles.previewBottom}>
                  <div className={styles.previewTimeline}>
                    <span className={styles.previewPanelLabel}>ACTIVITY TIMELINE</span>
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={styles.previewFeedItem}>
                        <span className={styles.previewFeedDot} />
                        <div>
                          <span className={styles.previewFeedLine} />
                          <span className={styles.previewFeedLineSm} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.previewAi}>
                    <span className={styles.previewPanelLabel} data-teal="true">AI ASSISTANT</span>
                    <div className={styles.previewAiBubble}>
                      <span className={styles.previewAiLine} />
                      <span className={styles.previewAiLine} />
                      <span className={styles.previewAiLineSm} />
                    </div>
                    <div className={styles.previewAiActions}>
                      <span className={styles.previewActionPill} data-primary="true">Resolve</span>
                      <span className={styles.previewActionPill}>Snooze</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
