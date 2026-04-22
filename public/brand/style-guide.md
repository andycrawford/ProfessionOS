# Profession OS — Brand Style Guide

**Version:** 1.1 (Board Approved)
**Author:** Brand Designer (DVI-59) · Updated: CMO (DVI-62)
**Date:** 2026-04-22

---

## Board-Approved Direction (2026-04-22)

| Element | Decision |
|---|---|
| **Icon mark** | Concept B "Meridian" — dark-circle compass, north point teal |
| **Hero treatment** | Concept A "Command" — dark terminal aesthetic, grid background |
| **Wordmark style** | Inter 600 + IBM Plex Mono teal " OS" |
| **Tagline** | "Every signal. One surface." |
| **Sub-copy** | "AI-powered command center for high-output professionals." |

**Canonical assets** (ready for use):

| File | Use |
|---|---|
| `logo.svg` | Primary brand logo — all marketing, social bios, email signatures, docs |
| `logo-icon.svg` | 48×48 icon mark — social profiles, favicons, app icon, docs header |
| `logo-concept-b.svg` | Light-mode logo — press kits, PDF documents, print-adjacent |
| `og-card.svg` | Social sharing card (1200×630) — `<meta og:image>`, Twitter/LinkedIn |
| `hero-concept-a.svg` | Marketing hero reference mockup |

> All other concept assets remain in `public/brand/` as reference variants. For any new marketing touchpoint, use the canonical files above.

---

## Three Concept Directions (Reference)

The three concept directions below are retained as reference. The board-approved hybrid (Concept B icon mark + Concept A hero/wordmark) was derived from this exploration.

---

## Shared Foundation

All three concepts inherit the existing app design system tokens:

| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent-brand` | `#00C9A7` | Teal — primary brand accent |
| `--color-accent-chart` | `#3D7EFF` | Blue — secondary / gradient |
| `--font-ui` | Inter | Headlines, body, nav |
| `--font-mono` | IBM Plex Mono | Code, labels, OS suffix (Concept A) |

---

## Concept A — "Command"
### _Terminal Heritage · Dark · Operator-grade_

**Philosophy:** Profession OS IS a command center. The brand should feel like elite professional tooling — not a consumer app. The `>_` prompt positions the product as the operating system layer for professional life. Appeals to power users, engineers, operators.

**Logo Mark:** Near-black rounded square (`#0D0F12`) with teal `>_` prompt symbol.  
**Wordmark:** "Profession" in Inter 600 (`#E8ECF0`) + " OS" in IBM Plex Mono teal (`#00C9A7`).  
**Assets:** `logo-concept-a.svg`, `hero-concept-a.svg`

**Color Palette:**
- Background: `#0D0F12`
- Surface: `#161A1F`
- Brand: `#00C9A7` (teal)
- Text: `#E8ECF0`
- Border: `#2A3140`

**Typography:**
- Headline: Inter 700, –3% letter-spacing
- Eyebrow: IBM Plex Mono 500, +6% letter-spacing, ALL CAPS
- Body: Inter 400, `#8B96A8`
- CTA: Inter 600

**Hero Headline:** "One OS for your entire professional life."  
**Hero Sub:** "Mail · Calendar · Code · CRM — monitored by AI, surfaced in one agentic command center."

**CTA:** "Start free →" (teal bg, dark text) + "View demo" (bordered, muted)

**Strengths:**
- Fully consistent with the existing app aesthetic — zero visual discontinuity
- Strong positioning for technical early adopters
- Teal accent creates immediate brand recognition

**Considerations:**
- Dark aesthetic may reduce conversion for non-technical audiences
- Less differentiated from dev tools / terminal apps

---

## Concept B — "Meridian"
### _Clean Professional · Light · Accessible SaaS_

**Philosophy:** Professional doesn't require dark. This concept brings order and clarity — a compass for your professional world. Light mode, confident type, teal as a warm accent on a clean canvas. Appeals to executives, managers, knowledge workers.

**Logo Mark:** White circle with four-point compass rose; north arrow in teal, center dot navy+teal.  
**Wordmark:** "Profession" in Inter 700 navy (`#0A1628`) + " OS" in teal (`#00C9A7`).  
**Assets:** `logo-concept-b.svg`, `hero-concept-b.svg`

**Color Palette:**
- Background: `#FFFFFF` / `#F7F9FC`
- Navy: `#0A1628` (deep professional anchor)
- Brand: `#00C9A7` (teal — warmer against light)
- Slate: `#64748B`
- Light border: `#E2E8F0`

**Typography:**
- Headline: Inter 800, –3.5% letter-spacing, navy
- Eyebrow: Inter 600, teal, pill badge
- Body: Inter 400, `#64748B`
- CTA: Inter 700

**Hero Headline:** "Navigate your professional world with one OS."  
**Hero Sub:** "Connect email, calendar, code repos, and your CRM. AI surfaces what matters. You act at speed."

**CTA:** "Start free →" (teal gradient bg) + "View live demo" (bordered navy)

**Strengths:**
- Broadest market appeal — works for non-technical professionals
- Compass mark reinforces navigation/clarity metaphor
- Light background converts well on landing pages
- App preview shown in a navy card — maintains design contrast

**Considerations:**
- Less differentiated from established SaaS brands
- Requires distinct light/dark logo variants for docs + GitHub

---

## Concept C — "Apex"
### _Premium Gradient · Dark · Aspirational_

**Philosophy:** For the professional operating at the highest level. Profession OS is the command center for people who play at the apex of their game. Rich dark gradient, glassmorphism card treatment, bold gradient typography. Appeals to ambitious professionals who identify with premium tool brands.

**Logo Mark:** Gradient circle (teal→blue) with abstract geometric "P" in white; subtle glow effect.  
**Wordmark:** "Profession" in Inter 700 dark + " OS" in teal→blue gradient fill.  
**Assets:** `logo-concept-c.svg`, `hero-concept-c.svg`

**Color Palette:**
- Dark canvas: `#070B12`
- Mid navy: `#0D1A2E`
- Brand gradient: `#00C9A7` → `#3D7EFF`
- Text: `#FFFFFF` (primary), `rgba(255,255,255,0.5)` (secondary)
- Glass: `rgba(255,255,255,0.06)` with `1px rgba(255,255,255,0.12)` border

**Typography:**
- Headline: Inter 800, –4% letter-spacing, white + gradient accent word
- Eyebrow: Inter 600, gradient fill, pill
- Body: Inter 400, `rgba(white, 0.5)`
- CTA: Inter 700, gradient pill button

**Hero Headline:** "Operate at your apex."  
**Hero Sub:** "One AI-powered command center for your email, calendar, code repositories, and CRM. Act faster. Miss nothing."

**CTA:** "Start free →" (gradient pill) + "Watch demo" (glass pill)

**Hero Layout:** Centered layout with floating glassmorphic metric cards below headline.

**Strengths:**
- Visually distinctive — premium, memorable, aspirational
- Teal→blue gradient creates a unique brand signature not seen in typical SaaS
- Floating cards layout showcases product without being a flat screenshot
- Hero more "art direction" than pure UI dump

**Considerations:**
- Gradient trends can date quickly (2026-era glassmorphism)
- More complex to implement faithfully in Next.js (needs careful CSS)
- May require an illustration/motion budget for full execution
- Centered layout reduces content density vs. left-aligned alternatives

---

## Recommendation (Superseded)

> **Note:** The board approved a hybrid direction on 2026-04-22. See the [Board-Approved Direction](#board-approved-direction-2026-04-22) section at the top of this document. The original recommendation below is retained for reference only.

**Original recommendation: Concept A ("Command")** for the early adopter launch.

Rationale:
1. Fully consistent with the existing `app.professionos.com` design system.
2. The `>_` terminal metaphor creates strong memorability and positioning.
3. Cheapest to implement — tokens already exist, assets drop right in.

**Board decision:** Hybrid — Concept B "Meridian" icon mark (broader appeal, navigation metaphor) + Concept A wordmark/hero style (consistent with app aesthetic). Best of both directions.

---

## Asset Index

### Logo Lockups (Mark + Wordmark)

| File | Description |
|------|-------------|
| `logo-concept-a.svg` | Concept A full lockup — dark, horizontal |
| `logo-concept-b.svg` | Concept B full lockup — light mode |
| `logo-concept-b-dark.svg` | Concept B full lockup — dark mode adaptation |
| `logo-concept-c.svg` | Concept C full lockup — gradient, works on dark |

### Icon-Only Marks

| File | Description |
|------|-------------|
| `logo-a-icon.svg` | Concept A mark only — 48×48, dark bg |
| `logo-b-icon-dark.svg` | Concept B mark only — 48×48, dark bg |
| `logo-c-icon.svg` | Concept C mark only — 48×48, gradient |

### Hero / Header Treatments (1200×630)

| File | Description |
|------|-------------|
| `hero-concept-a.svg` | Concept A hero mockup — dark, terminal |
| `hero-concept-b.svg` | Concept B hero mockup — light, clean professional |
| `hero-concept-c.svg` | Concept C hero mockup — dark, premium gradient |

### Social / Meta Assets

| File | Description |
|------|-------------|
| `og-card.svg` | OG social card — 1200×630, Concept A direction |
| `../favicon.svg` | SVG favicon — Concept A mark, 48×48 viewBox |

### Reference

| File | Description |
|------|-------------|
| `style-guide.md` | This document — concept rationale and asset index |

---

## PNG Export

PNG exports (1x/2x) are required for browsers that do not support SVG `<img>` tags and for social card meta tags. Export each SVG at the following sizes:

| Asset type | 1x | 2x |
|---|---|---|
| Logo lockup | 280×56 | 560×112 |
| Icon mark | 48×48 | 96×96 |
| Hero / OG card | 1200×630 | 2400×1260 |
| Favicon | 32×32 | 64×64 |

**Recommended export method:**
```bash
# Using Inkscape (headless):
inkscape logo-a-icon.svg --export-png=logo-a-icon.png --export-width=48

# Or via browser DevTools → right-click SVG → "Save as PNG"
# Or via npx svgexport (node): npx svgexport og-card.svg og-card.png 1200:630
```

All SVG files are production-quality and can be directly embedded or referenced in the Next.js marketing site.
