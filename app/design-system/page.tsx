/**
 * Profession OS — Design System / Component Library
 *
 * Engineering handoff companion for DVI-51.
 * Accessible at /design-system in the running app.
 *
 * Sections:
 *   1. Widget Card (all 6 states)
 *   2. Alert Hierarchy (P0–P3) with animation notes
 *   3. AI Assistant Panel components
 *   4. Navigation Rail & Topbar
 *   5. Color Palette (full token set)
 *   6. Typography Scale
 *   7. Spacing & Radius tokens
 *   8. Motion Design spec
 *   9. Keyboard Shortcuts
 *  10. Accessibility Annotations
 */

"use client";

import { useState } from "react";
import {
  Mail,
  Calendar,
  MessageSquare,
  Code2,
  Users,
  Sparkles,
} from "lucide-react";

import WidgetCard from "@/components/widgets/WidgetCard";
import AlertBar, { type Alert } from "@/components/layout/AlertBar";
import AiPanel, {
  type ChatMessage,
  type Suggestion,
} from "@/components/layout/AiPanel";

import styles from "./ds.module.css";

// ── Static sample data ────────────────────────────────────────────

const SAMPLE_SPARKLINE = [42, 58, 51, 73, 60, 88, 95, 112, 124];

const CRITICAL_ALERTS: Alert[] = [
  {
    id: "c1",
    severity: "critical",
    service: "Code",
    summary: "Deployment pipeline failed — production build",
  },
  {
    id: "c2",
    severity: "critical",
    service: "CRM",
    summary: "Contract renewal due in 4 hours — Acme Corp",
  },
];
const WARNING_ALERTS: Alert[] = [
  {
    id: "w1",
    severity: "warning",
    service: "Calendar",
    summary: "3 calendar conflicts detected on Thursday",
  },
];
const INFO_ALERTS: Alert[] = [
  {
    id: "i1",
    severity: "info",
    service: "Email",
    summary: "Digest ready — 14 newsletters auto-archived",
  },
];

const SAMPLE_SUGGESTION: Suggestion = {
  id: "s1",
  body: "3 calendar conflicts detected on Thursday. Reschedule the 2pm stand-up to 4pm?",
  actions: ["Resolve", "Snooze", "Ask AI"],
};

const SAMPLE_MESSAGES: ChatMessage[] = [
  { id: "m1", role: "ai", content: "I noticed 47 unread messages this week. Want me to surface the action items?" },
  { id: "m2", role: "user", content: "Yes, please summarize those." },
  { id: "m3", role: "ai", content: "Found 6 action items: 2 require responses today, 3 are FYIs, 1 is blocked on design review." },
];

// ── Color token table ─────────────────────────────────────────────

const COLOR_TOKENS = [
  // Backgrounds
  { name: "bg-base",    value: "#0D0F12", token: "--color-bg-base",    role: "Main canvas" },
  { name: "bg-surface", value: "#161A1F", token: "--color-bg-surface", role: "Cards, panels" },
  { name: "bg-raised",  value: "#1E2329", token: "--color-bg-raised",  role: "Hover, expanded" },
  { name: "bg-overlay", value: "#252D38", token: "--color-bg-overlay", role: "Modals, palette" },
  // Borders
  { name: "border-default", value: "#2A3140", token: "--color-border-default", role: "Card outlines" },
  { name: "border-subtle",  value: "#1E2633", token: "--color-border-subtle",  role: "Intra-card" },
  { name: "border-focus",   value: "#3D7EFF", token: "--color-border-focus",   role: "Focus rings" },
  // Text
  { name: "text-primary",   value: "#E8ECF0", token: "--color-text-primary",   role: "Headings, figures" },
  { name: "text-secondary", value: "#8B96A8", token: "--color-text-secondary", role: "Labels, meta" },
  { name: "text-disabled",  value: "#4A5568", token: "--color-text-disabled",  role: "Inactive only" },
  // Accent
  { name: "accent-brand", value: "#00C9A7", token: "--color-accent-brand", role: "Active nav, AI, CTA" },
  { name: "accent-chart", value: "#3D7EFF", token: "--color-accent-chart", role: "Data vis only" },
  // Alerts
  { name: "alert-critical", value: "#FF4757", token: "--color-alert-critical", role: "P0 — immediate" },
  { name: "alert-warning",  value: "#FFA502", token: "--color-alert-warning",  role: "P1 — deadline" },
  { name: "alert-info",     value: "#2ED573", token: "--color-alert-info",     role: "P2 — all-clear" },
  { name: "alert-neutral",  value: "#6B778C", token: "--color-alert-neutral",  role: "P3 — low priority" },
];

// ── Typography token table ────────────────────────────────────────

const TYPE_TOKENS = [
  { token: "--text-wordmark",   size: "13px", weight: "500", font: "IBM Plex Mono", spacing: "0.12em", use: "Product name in topbar" },
  { token: "--text-label-caps", size: "11px", weight: "600", font: "Inter",         spacing: "0.08em (uppercase)", use: "Card labels, column headers" },
  { token: "--text-metric-xl",  size: "36px", weight: "700", font: "Inter",         spacing: "-0.02em", use: "Primary KPI figure" },
  { token: "--text-metric-lg",  size: "28px", weight: "700", font: "Inter",         spacing: "-0.01em", use: "Secondary KPI" },
  { token: "--text-heading-sm", size: "14px", weight: "600", font: "Inter",         spacing: "0",       use: "Card titles" },
  { token: "--text-body-base",  size: "13px", weight: "400", font: "Inter",         spacing: "0",       use: "Feed items, descriptions" },
  { token: "--text-body-sm",    size: "12px", weight: "400", font: "Inter",         spacing: "0",       use: "Meta, secondary content" },
  { token: "--text-timestamp",  size: "11px", weight: "400", font: "IBM Plex Mono", spacing: "0",       use: "Feed timestamps" },
  { token: "--text-tag",        size: "11px", weight: "500", font: "Inter",         spacing: "0.04em",  use: "Severity tags, chips" },
];

// ── Motion spec ───────────────────────────────────────────────────

const MOTION_TABLE = [
  { animation: "Panel collapse/expand",  duration: "200ms",   easing: "ease-out",           token: "--duration-default" },
  { animation: "Card hover lift",        duration: "100ms",   easing: "ease",               token: "--duration-fast" },
  { animation: "Alert pulse",            duration: "2000ms",  easing: "ease-in-out (∞)",    token: "--duration-alert" },
  { animation: "Feed item enter",        duration: "250ms",   easing: "ease-out (slide+fade)", token: "--duration-slow" },
  { animation: "Suggestion card swap",   duration: "300ms",   easing: "ease-in-out (fade)", token: "--duration-slow" },
  { animation: "Command palette open",   duration: "150ms",   easing: "ease-out",           token: "--duration-default" },
  { animation: "Tooltip appear",         duration: "100ms",   easing: "ease",               token: "--duration-fast" },
  { animation: "Nav rail expand",        duration: "200ms",   easing: "ease-out",           token: "--duration-default" },
];

// ── Keyboard shortcut table ───────────────────────────────────────

const SHORTCUTS = [
  { key: "⌘K",          action: "Open command palette" },
  { key: "⌘⇧A",         action: "Focus AI panel" },
  { key: "⌘⇧F",         action: "Focus activity feed" },
  { key: "F",           action: "Focus feed filter bar" },
  { key: "J / K",       action: "Navigate feed items (vim-style)" },
  { key: "E",           action: "Archive selected feed item" },
  { key: "S",           action: "Snooze selected feed item" },
  { key: "⌘↵",          action: "Send AI chat message" },
  { key: "Esc",         action: "Close modal / dismiss overlay" },
  { key: "?",           action: "Show keyboard shortcut reference" },
];

// ── Component ─────────────────────────────────────────────────────

export default function DesignSystemPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(SAMPLE_MESSAGES);

  return (
    <div className={styles.page}>
      {/* Page header */}
      <header className={styles.header}>
        <span className={styles.headerTitle}>PROFESSION OS</span>
        <span className={styles.headerSubtitle}>
          Design System — Component Library
        </span>
        <span className={styles.headerBadge}>DVI-51</span>
      </header>

      <div className={styles.layout}>
        {/* ── Table of Contents ──────────────────────────────── */}
        <nav className={styles.toc} aria-label="Design system sections">
          <p className={styles.tocTitle}>Contents</p>
          {[
            ["#widget-cards",    "Widget Cards"],
            ["#alert-hierarchy", "Alert Hierarchy"],
            ["#alert-bar",       "Alert Bar"],
            ["#ai-panel",        "AI Assistant Panel"],
            ["#colors",          "Color Palette"],
            ["#typography",      "Typography"],
            ["#spacing",         "Spacing & Radius"],
            ["#motion",          "Motion"],
            ["#shortcuts",       "Keyboard Shortcuts"],
            ["#a11y",            "Accessibility"],
          ].map(([href, label]) => (
            <a key={href} href={href} className={styles.tocItem}>
              {label}
            </a>
          ))}
        </nav>

        {/* ── Main content ───────────────────────────────────── */}
        <main className={styles.main}>

          {/* ━━━ 1. Widget Cards ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="widget-cards" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Widget Cards</h2>
              <span className={styles.sectionSubtitle}>
                All 6 display states — 120px fixed height
              </span>
              <span className={styles.specRef}>§5</span>
            </div>

            <div className={styles.widgetGrid}>
              {/* Default */}
              <div className={styles.widgetItem}>
                <span className={styles.stateLabel}>Default</span>
                <WidgetCard
                  serviceLabel="EMAIL"
                  serviceIcon={<Mail size={16} />}
                  primaryMetric={124}
                  secondaryLabel="new messages"
                  deltaPercent={18}
                  sparklineData={SAMPLE_SPARKLINE}
                  state="default"
                />
              </div>

              {/* Hover (forced via prop) */}
              <div className={styles.widgetItem}>
                <span className={styles.stateLabel}>Hover</span>
                <WidgetCard
                  serviceLabel="EMAIL"
                  serviceIcon={<Mail size={16} />}
                  primaryMetric={124}
                  secondaryLabel="new messages"
                  deltaPercent={18}
                  sparklineData={SAMPLE_SPARKLINE}
                  state="hover"
                />
              </div>

              {/* Warning */}
              <div className={styles.widgetItem}>
                <span className={styles.stateLabel}>Warning (P1)</span>
                <WidgetCard
                  serviceLabel="CALENDAR"
                  serviceIcon={<Calendar size={16} />}
                  primaryMetric={8}
                  secondaryLabel="meetings today"
                  deltaPercent={0}
                  sparklineData={[8, 6, 9, 7, 10, 8, 11, 9, 12]}
                  state="warning"
                  alertCount={3}
                />
              </div>

              {/* Critical */}
              <div className={styles.widgetItem}>
                <span className={styles.stateLabel}>Critical (P0)</span>
                <WidgetCard
                  serviceLabel="CODE"
                  serviceIcon={<Code2 size={16} />}
                  primaryMetric={3}
                  secondaryLabel="PRs failing CI"
                  deltaPercent={-40}
                  sparklineData={[9, 8, 10, 7, 9, 6, 8, 5, 3]}
                  state="critical"
                  alertCount={1}
                />
              </div>

              {/* Loading */}
              <div className={styles.widgetItem}>
                <span className={styles.stateLabel}>Loading</span>
                <WidgetCard
                  serviceLabel="MESSAGING"
                  serviceIcon={<MessageSquare size={16} />}
                  state="loading"
                />
              </div>

              {/* Empty */}
              <div className={styles.widgetItem}>
                <span className={styles.stateLabel}>Empty</span>
                <WidgetCard
                  serviceLabel="CRM"
                  serviceIcon={<Users size={16} />}
                  state="empty"
                />
              </div>
            </div>

            {/* Accessibility annotation */}
            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>Accessibility — §11</p>
              <p>
                <strong>Critical state animation</strong> respects{" "}
                <code>prefers-reduced-motion</code>: pulse becomes a static
                red border. <strong>Alert dot</strong> is supplementary — the
                parent card&apos;s <code>aria-label</code> includes
                &ldquo;critical alert&rdquo; so color is never the sole
                indicator. Cards are <code>role="article"</code> with full
                <code>aria-label</code> describing metric + state.
              </p>
            </div>
          </section>

          {/* ━━━ 2. Alert Hierarchy (P0–P3) ━━━━━━━━━━━━━━━━━━━ */}
          <section id="alert-hierarchy" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Alert Hierarchy</h2>
              <span className={styles.sectionSubtitle}>
                P0–P3 severity levels with rendering rules
              </span>
              <span className={styles.specRef}>§6.1</span>
            </div>

            <div className={styles.alertHierarchy}>
              {/* P0 */}
              <div className={styles.alertHierarchyItem} data-priority="P0">
                <span className={styles.priorityTag}>P0</span>
                <span className={`${styles.severityDot} ${styles.dotCritical}`} aria-hidden="true" />
                <span className={`${styles.alertItemTitle} ${styles.urgent}`}>
                  Pipeline failed — production build
                </span>
                <span className={styles.alertItemBehavior}>
                  Alert bar (red) · card pulse · topbar badge · optional sound
                </span>
              </div>

              {/* P1 */}
              <div className={styles.alertHierarchyItem} data-priority="P1">
                <span className={styles.priorityTag}>P1</span>
                <span className={`${styles.severityDot} ${styles.dotWarning}`} aria-hidden="true" />
                <span className={`${styles.alertItemTitle} ${styles.urgent}`}>
                  Contract renewal due in 4 hours
                </span>
                <span className={styles.alertItemBehavior}>
                  Alert bar (amber) · card accent bar · topbar badge
                </span>
              </div>

              {/* P2 */}
              <div className={styles.alertHierarchyItem} data-priority="P2">
                <span className={styles.priorityTag}>P2</span>
                <span className={`${styles.severityDot} ${styles.dotInfo}`} aria-hidden="true" />
                <span className={styles.alertItemTitle}>
                  Sprint review notes shared by Sarah Chen
                </span>
                <span className={styles.alertItemBehavior}>
                  Feed entry only (green dot) · topbar badge count
                </span>
              </div>

              {/* P3 */}
              <div className={styles.alertHierarchyItem} data-priority="P3">
                <span className={styles.priorityTag}>P3</span>
                <span className={`${styles.severityDot} ${styles.dotNeutral}`} aria-hidden="true" />
                <span className={styles.alertItemTitle}>
                  14 newsletters auto-archived
                </span>
                <span className={styles.alertItemBehavior}>
                  Feed entry only (neutral dot) · no badge
                </span>
              </div>
            </div>

            {/* Critical pulse animation spec */}
            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>P0 Pulse Animation — §6.3</p>
              <p>
                <strong>CSS:</strong>{" "}
                <code>animation: alert-pulse 2s ease-in-out infinite</code>
                {" "}— keyframe defined in <code>globals.css</code> as the
                global <code>@keyframes alert-pulse</code>. The{" "}
                <code>prefers-reduced-motion</code> override collapses both
                keyframe states to a static{" "}
                <code>box-shadow: 0 0 0 1px #FF4757</code>.
              </p>
            </div>
          </section>

          {/* ━━━ 3. Alert Bar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="alert-bar" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Alert Bar</h2>
              <span className={styles.sectionSubtitle}>
                Mounts below topbar when P0/P1 alerts exist, 40px
              </span>
              <span className={styles.specRef}>§6.2</span>
            </div>

            <div className={styles.alertVariants}>
              <div className={styles.alertVariantRow}>
                <span className={styles.stateLabel}>Critical (P0) — assertive aria-live</span>
                <div className={styles.previewBox}>
                  <AlertBar
                    alerts={CRITICAL_ALERTS}
                    onDismissAll={() => {}}
                    onViewAll={() => {}}
                  />
                </div>
              </div>

              <div className={styles.alertVariantRow}>
                <span className={styles.stateLabel}>Warning (P1) — polite aria-live</span>
                <div className={styles.previewBox}>
                  <AlertBar
                    alerts={WARNING_ALERTS}
                    onDismissAll={() => {}}
                    onViewAll={() => {}}
                  />
                </div>
              </div>

              <div className={styles.alertVariantRow}>
                <span className={styles.stateLabel}>Info (P2) — polite aria-live</span>
                <div className={styles.previewBox}>
                  <AlertBar
                    alerts={INFO_ALERTS}
                    onDismissAll={() => {}}
                    onViewAll={() => {}}
                  />
                </div>
              </div>

              <div className={styles.alertVariantRow}>
                <span className={styles.stateLabel}>Multiple alerts — marquee scrolling</span>
                <div className={styles.previewBox}>
                  <AlertBar
                    alerts={[...CRITICAL_ALERTS, ...WARNING_ALERTS]}
                    onDismissAll={() => {}}
                    onViewAll={() => {}}
                  />
                </div>
              </div>
            </div>

            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>Accessibility — §11</p>
              <p>
                Alert bar uses <code>role=&quot;region&quot;</code> +{" "}
                <code>aria-label=&quot;Active alerts&quot;</code> +{" "}
                <code>aria-live=&quot;assertive&quot;</code> for P0.{" "}
                P1 uses <code>aria-live=&quot;polite&quot;</code>.
                Color is reinforced by icon + severity badge text — never
                color alone.
              </p>
            </div>
          </section>

          {/* ━━━ 4. AI Assistant Panel ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="ai-panel" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>AI Assistant Panel</h2>
              <span className={styles.sectionSubtitle}>
                320px right panel · proactive suggestion · chat · Cmd+K palette
              </span>
              <span className={styles.specRef}>§8</span>
            </div>

            <div className={styles.previewBox} style={{ height: 520 }}>
              <AiPanel
                suggestion={SAMPLE_SUGGESTION}
                messages={messages}
                onSendMessage={(content) =>
                  setMessages((prev) => [
                    ...prev,
                    { id: `m${Date.now()}`, role: "user", content },
                  ])
                }
                onSuggestionAction={() => {}}
              />
            </div>

            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>Panel states — §8.1</p>
              <p>
                <strong>Expanded (320px):</strong> Full panel with suggestion
                card, chat thread, and input.{" "}
                <strong>Collapsed (40px):</strong> Icon-only rail — the
                collapse button toggles{" "}
                <code>aria-expanded</code> on the panel wrapper.{" "}
                <strong>Chat thread:</strong>{" "}
                <code>role=&quot;log&quot;</code> with{" "}
                <code>aria-live=&quot;polite&quot;</code> and{" "}
                <code>aria-relevant=&quot;additions&quot;</code>.{" "}
                <strong>Thinking indicator:</strong>{" "}
                <code>role=&quot;status&quot;</code>.
              </p>
            </div>

            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>Cmd+K Command Palette — §8.4</p>
              <p>
                Full-screen overlay with blur backdrop on main content.
                <strong> Input auto-focused</strong> on open.
                Results grouped by type: Actions, Contacts, Issues, Docs, Recent.
                AI-powered fuzzy + semantic matching.
                Dismiss with <kbd>Esc</kbd>. ARIA:{" "}
                <code>role=&quot;dialog&quot;</code> +{" "}
                <code>aria-modal=&quot;true&quot;</code> +{" "}
                <code>aria-label=&quot;Command palette&quot;</code>.
              </p>
            </div>
          </section>

          {/* ━━━ 5. Color Palette ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="colors" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Color Palette</h2>
              <span className={styles.sectionSubtitle}>
                Full CSS custom property token set — §3 &amp; §12
              </span>
              <span className={styles.specRef}>§3</span>
            </div>

            <div className={styles.colorGrid}>
              {COLOR_TOKENS.map(({ name, value, token, role }) => (
                <div key={token} className={styles.colorSwatch}>
                  <div
                    className={styles.colorChip}
                    style={{ background: value }}
                    role="img"
                    aria-label={`${name}: ${value}`}
                  />
                  <div className={styles.colorMeta}>
                    <p className={styles.colorName}>{name}</p>
                    <p className={styles.colorToken}>{token}</p>
                    <p>{role}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>Usage Rules — §3.3</p>
              <p>
                <strong>Never use alert colors decoratively</strong> — only
                for actual alert state.{" "}
                <strong>accent-brand (teal)</strong> reserved for: active nav,
                AI highlights, primary CTA.{" "}
                <strong>accent-chart (blue)</strong> reserved for sparklines,
                charts, data points <em>only</em>.{" "}
                All text combos meet WCAG AA (4.5:1 for body, 3:1 for large
                text) against <code>--color-bg-surface</code>.
              </p>
            </div>
          </section>

          {/* ━━━ 6. Typography Scale ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="typography" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Typography Scale</h2>
              <span className={styles.sectionSubtitle}>
                Inter (UI) + IBM Plex Mono (data/timestamps) — §4
              </span>
              <span className={styles.specRef}>§4</span>
            </div>

            <div className={styles.typeRows}>
              {TYPE_TOKENS.map(({ token, size, weight, font, spacing, use }) => (
                <div key={token} className={styles.typeRow}>
                  <div className={styles.typeMeta}>
                    <span className={styles.typeTokenName}>{token}</span>
                    <span className={styles.typeSpec}>
                      {font} · {size} / {weight} · ls {spacing}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: font.includes("Mono")
                        ? "var(--font-mono)"
                        : "var(--font-ui)",
                      fontSize: size,
                      fontWeight: weight,
                      letterSpacing: spacing === "0" ? "normal" : spacing,
                      textTransform:
                        token.includes("label") || token.includes("wordmark")
                          ? "uppercase"
                          : "none",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {token.includes("wordmark")
                      ? "PROFESSION OS"
                      : token.includes("metric-xl")
                      ? "124"
                      : token.includes("metric-lg")
                      ? "48"
                      : token.includes("timestamp")
                      ? "09:42"
                      : token.includes("label")
                      ? "EMAIL"
                      : "The quick brown fox"}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--text-body-sm-size)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {use}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ━━━ 7. Spacing & Radius ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="spacing" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Spacing &amp; Radius</h2>
              <span className={styles.sectionSubtitle}>
                4px base grid · §12
              </span>
              <span className={styles.specRef}>§12</span>
            </div>

            <div className={styles.previewGrid2}>
              {/* Spacing */}
              <div>
                <p
                  className={styles.stateLabel}
                  style={{ marginBottom: "var(--space-2)" }}
                >
                  Spacing
                </p>
                <div className={styles.spacingRows}>
                  {[
                    { token: "--space-1", value: 4 },
                    { token: "--space-2", value: 8 },
                    { token: "--space-3", value: 12 },
                    { token: "--space-4", value: 16 },
                    { token: "--space-6", value: 24 },
                    { token: "--space-8", value: 32 },
                  ].map(({ token, value }) => (
                    <div key={token} className={styles.spacingRow}>
                      <div
                        className={styles.spacingBar}
                        style={{ width: value * 2 }}
                        role="img"
                        aria-label={`${value}px`}
                      />
                      <span className={styles.spacingLabel}>
                        {token} — {value}px
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radius */}
              <div>
                <p
                  className={styles.stateLabel}
                  style={{ marginBottom: "var(--space-2)" }}
                >
                  Border Radius
                </p>
                <div className={styles.spacingRows}>
                  {[
                    { token: "--radius-sm",      value: 2,  use: "Tags, kbd" },
                    { token: "--radius-default",  value: 4,  use: "Cards, buttons, inputs" },
                    { token: "--radius-md",       value: 6,  use: "Softer interactive" },
                    { token: "--radius-lg",       value: 8,  use: "Modals, drawers" },
                  ].map(({ token, value, use }) => (
                    <div key={token} className={styles.spacingRow}>
                      <div
                        style={{
                          width:         40,
                          height:        24,
                          background:    "var(--color-bg-raised)",
                          border:        "1px solid var(--color-border-default)",
                          borderRadius:  value,
                          flexShrink:    0,
                        }}
                        role="img"
                        aria-label={`${value}px radius`}
                      />
                      <span className={styles.spacingLabel}>
                        {token} — {value}px · {use}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ━━━ 8. Motion ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="motion" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Motion Design</h2>
              <span className={styles.sectionSubtitle}>
                All animations respect prefers-reduced-motion — §9.2
              </span>
              <span className={styles.specRef}>§9.2</span>
            </div>

            <table className={styles.motionTable}>
              <thead>
                <tr>
                  <th>Animation</th>
                  <th>Duration</th>
                  <th>Easing</th>
                  <th>Token</th>
                </tr>
              </thead>
              <tbody>
                {MOTION_TABLE.map((row) => (
                  <tr key={row.animation}>
                    <td>{row.animation}</td>
                    <td><code>{row.duration}</code></td>
                    <td><code>{row.easing}</code></td>
                    <td><code>{row.token}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={styles.annotation}>
              <p className={styles.annotationTitle}>prefers-reduced-motion</p>
              <p>
                The global override in <code>globals.css</code> sets{" "}
                <code>animation-duration: 0.01ms</code> and{" "}
                <code>transition-duration: 0.01ms</code> for all elements.
                The P0 alert pulse keyframe additionally has a separate
                reduced-motion version that collapses both 0% and 100% states
                to the same static box-shadow — eliminating the pulsing
                without removing the visual indicator entirely.
              </p>
            </div>
          </section>

          {/* ━━━ 9. Keyboard Shortcuts ━━━━━━━━━━━━━━━━━━━━━━━━━ */}
          <section id="shortcuts" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Keyboard Shortcuts</h2>
              <span className={styles.sectionSubtitle}>
                Global shortcuts — §9.1
              </span>
              <span className={styles.specRef}>§9.1</span>
            </div>

            <table className={styles.kbdTable}>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map(({ key, action }) => (
                  <tr key={key}>
                    <td>
                      <kbd className={styles.kbdKey}>{key}</kbd>
                    </td>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ━━━ 10. Accessibility Annotations ━━━━━━━━━━━━━━━━━━ */}
          <section id="a11y" className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>
                Accessibility Annotations
              </h2>
              <span className={styles.sectionSubtitle}>
                WCAG 2.1 AA compliance requirements — §11
              </span>
              <span className={styles.specRef}>§11</span>
            </div>

            {[
              {
                title: "Focus Management",
                body: "All interactive elements show a visible focus ring: 2px solid var(--color-border-focus) (#3D7EFF), 2px offset. Command palette auto-focuses input on open. Modals trap focus (Tab cycles within). Dismiss closes modal and returns focus to the triggering element.",
              },
              {
                title: "Landmark Structure",
                body: "<header role=\"banner\"> → Topbar. <nav aria-label=\"Primary navigation\"> → NavRail. <main> → Content area. <aside aria-label=\"AI Assistant\"> → AI panel. <div role=\"region\" aria-label=\"Alert bar\"> → AlertBar.",
              },
              {
                title: "Color — Not Sole Indicator",
                body: "Every alert/status state combines: (1) color, (2) icon, (3) text label. Widget card alert states include the severity in aria-label. Feed item severity dots have aria-hidden=\"true\"; the parent div has aria-label with severity text.",
              },
              {
                title: "Live Regions",
                body: "Alert bar (P0): aria-live=\"assertive\" aria-atomic=\"false\". Alert bar (P1): aria-live=\"polite\". AI suggestion card: aria-live=\"polite\". Chat thread: role=\"log\" aria-live=\"polite\" aria-relevant=\"additions\". AI thinking state: role=\"status\".",
              },
              {
                title: "Screen Reader Landmarks",
                body: "Feed list uses role=\"feed\". Each feed item is role=\"article\". Date separators are role=\"separator\". Widget row section has aria-label=\"Service summary widgets\". Filter chip group uses role=\"group\" aria-label=\"Filter activity by service\".",
              },
              {
                title: "Icon Accessibility",
                body: "All decorative Lucide icons have aria-hidden=\"true\". Icons used as the sole content of a button have an adjacent aria-label on the button. Service icon labels are visible (text) or provided via aria-label on the containing element.",
              },
              {
                title: "Contrast Ratios",
                body: "text-primary (#E8ECF0) on bg-surface (#161A1F): 14.6:1 (AAA). text-secondary (#8B96A8) on bg-surface: 5.4:1 (AA). accent-brand (#00C9A7) on bg-base (#0D0F12): 6.8:1 (AA). alert-critical (#FF4757) on bg-base: 4.7:1 (AA).",
              },
              {
                title: "Responsive Accessibility",
                body: "At <768px (mobile), the NavRail is hidden and replaced with bottom tab navigation (engineering task). Focus order follows DOM order. AI panel is hidden on mobile; accessible via a dedicated button. All touch targets ≥ 44×44px at mobile breakpoints.",
              },
            ].map(({ title, body }) => (
              <div key={title} className={styles.annotation}>
                <p className={styles.annotationTitle}>{title}</p>
                <p
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </div>
            ))}
          </section>

        </main>
      </div>
    </div>
  );
}
