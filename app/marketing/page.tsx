import type { Metadata } from "next";
import Image from "next/image";
import styles from "./page.module.css";
import ProfessionCycler from "@/components/marketing/ProfessionCycler";
import {
  LayoutDashboard,
  Sparkles,
  Activity,
  BarChart3,
  BellRing,
  Plug,
} from "lucide-react";

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
            <a href="https://app.professionos.com/sign-in" className={styles.navLinkSecondary}>Sign in</a>
            <a href="/sign-up" className={styles.navCta}>Get Started</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <main className={styles.hero}>
        <div className={styles.heroLeft}>
          {/* Brand reveal animation: cycles professions before landing on "Profession OS" */}
          <ProfessionCycler />

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
                    { label: "MESSAGING", value: "248", delta: "↓ 5%", status: "down" },
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

      {/* ── Features ───────────────────────────────────────────────── */}
      <section id="features" className={styles.features}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Features</span>
            <h2 className={styles.sectionTitle}>Everything you need. Nothing you don&apos;t.</h2>
            <p className={styles.sectionSubtitle}>
              Profession OS unifies your most critical work signals in one keyboard-driven command center — powered by AI that understands context.
            </p>
          </div>

          <div className={styles.featureGrid}>
            {[
              {
                icon: <LayoutDashboard size={18} />,
                title: "Command Center",
                description:
                  "A keyboard-driven workspace that unifies all your professional tools in one surface. Launch, navigate, and act without leaving the keyboard.",
              },
              {
                icon: <Sparkles size={18} />,
                title: "AI Assistant",
                description:
                  "Ask questions across your entire work graph. Get grounded, context-aware answers sourced from your real data — not hallucinations.",
              },
              {
                icon: <Activity size={18} />,
                title: "Activity Timeline",
                description:
                  "A real-time feed of every signal across Email, Calendar, Messages, GitHub, and CRM. Nothing falls through the cracks.",
              },
              {
                icon: <BarChart3 size={18} />,
                title: "Live Widgets",
                description:
                  "At-a-glance metrics for email volume, calendar load, unread messages, open PRs, and CRM follow-ups — updated continuously.",
              },
              {
                icon: <BellRing size={18} />,
                title: "Signal Intelligence",
                description:
                  "AI surfaces anomalies and opportunities before they become problems. Critical alerts are prioritized, noise is suppressed.",
              },
              {
                icon: <Plug size={18} />,
                title: "One-Click Integrations",
                description:
                  "Connect GitHub, Google, Linear, Salesforce, and more via OAuth in seconds. All your services, one unified data model.",
              },
            ].map((f) => (
              <div key={f.title} className={styles.featureCard}>
                <div className={styles.featureIcon}>{f.icon}</div>
                <h3 className={styles.featureTitle}>{f.title}</h3>
                <p className={styles.featureDescription}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────── */}
      <section id="pricing" className={styles.pricing}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionEyebrow}>Pricing</span>
            <h2 className={styles.sectionTitle}>Simple, transparent pricing.</h2>
            <p className={styles.sectionSubtitle}>
              Choose the plan that fits your workflow. All plans include a 14-day free trial.
            </p>
          </div>

          <div className={styles.pricingGrid}>
            {/* Individual */}
            <div className={styles.pricingCard}>
              <div className={styles.pricingCardHeader}>
                <span className={styles.planName}>Individual</span>
                <p className={styles.planTagline}>For solo professionals who demand clarity.</p>
              </div>
              <div className={styles.planPrice}>
                <span className={styles.planPriceLabel}>Pricing coming soon</span>
              </div>
              <ul className={styles.planFeatures} role="list">
                <li>5 service integrations</li>
                <li>AI Assistant (100 queries/day)</li>
                <li>Activity timeline</li>
                <li>Live widgets dashboard</li>
                <li>30-day signal history</li>
                <li>Email support</li>
              </ul>
              <a href="/sign-up" className={styles.planCta}>Get notified →</a>
            </div>

            {/* Team */}
            <div className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}>
              <div className={styles.featuredBadge}>Most Popular</div>
              <div className={styles.pricingCardHeader}>
                <span className={styles.planName}>Team</span>
                <p className={styles.planTagline}>For high-output teams that move fast.</p>
              </div>
              <div className={styles.planPrice}>
                <span className={styles.planPriceLabel}>Pricing coming soon</span>
              </div>
              <ul className={styles.planFeatures} role="list">
                <li>Everything in Individual</li>
                <li>Unlimited integrations</li>
                <li>AI Assistant (unlimited)</li>
                <li>Shared team workspace</li>
                <li>1-year signal history</li>
                <li>Admin controls</li>
                <li>Priority support</li>
              </ul>
              <a href="/sign-up" className={`${styles.planCta} ${styles.planCtaPrimary}`}>Get notified →</a>
            </div>

            {/* Enterprise */}
            <div className={styles.pricingCard}>
              <div className={styles.pricingCardHeader}>
                <span className={styles.planName}>Enterprise</span>
                <p className={styles.planTagline}>For organizations with enterprise-grade needs.</p>
              </div>
              <div className={styles.planPrice}>
                <span className={styles.planPriceLabel}>Contact us</span>
              </div>
              <ul className={styles.planFeatures} role="list">
                <li>Everything in Team</li>
                <li>SSO / SAML</li>
                <li>Audit logs</li>
                <li>Custom data retention</li>
                <li>Dedicated onboarding</li>
                <li>SLA & 24/7 support</li>
                <li>Custom integrations</li>
              </ul>
              <a href="mailto:sales@professionos.com" className={styles.planCta}>Talk to sales →</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <a href="/" className={styles.footerBrand} aria-label="Profession OS">
            <Image src="/brand/logo.svg" alt="Profession OS" width={110} height={22} />
          </a>
          <p className={styles.footerCopy}>© 2026 Profession OS. All rights reserved.</p>
          <nav className={styles.footerLinks} aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/docs">Docs</a>
            <a href="/blog">Blog</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
