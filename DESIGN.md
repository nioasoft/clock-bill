---
name: ClockBill
description: A living work ledger that turns every recorded detail into a clear money trail.
colors:
  midnight-canvas: "#0a0a0a"
  ledger-surface: "#121212"
  raised-surface: "#1a1a1a"
  active-surface: "#242424"
  warm-paper: "#f4f4f2"
  ink: "#1a1a18"
  billable-lime: "#faff69"
  daylight-gold: "#806600"
  quiet-ink: "#888888"
  hairline: "#2a2a2a"
  positive: "#22c55e"
  warning: "#f59e0b"
  destructive: "#ef4444"
typography:
  display:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Heebo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  numeric:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  control: "8px"
  card: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.billable-lime}"
    textColor: "{colors.midnight-canvas}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.raised-surface}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.raised-surface}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.raised-surface}"
    textColor: "#ffffff"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: ClockBill

## 1. Overview

**Creative North Star: "The Living Work Ledger"**

ClockBill should feel like a ledger that fills itself while the freelancer works. Every timer, item, task, document, and payment belongs to one continuous money trail. The experience is fast and exact, but the interface welcomes the user before asking them to make financial decisions.

The current system is themeable and primarily dark, with compact controls, tonal surfaces, hairline borders, and a sharp accent. The marketing surface may use a warmer and more open composition than the authenticated product, while both surfaces share the same semantic tokens, typography, interaction states, and financial formatting.

The system explicitly rejects the coldness of a developer infrastructure dashboard, the density and anxiety of enterprise finance software, and generic SaaS marketing built from vague claims, decorative gradients, or interchangeable feature-card grids.

**Key Characteristics:**

- Work flows visibly toward a financial outcome.
- Dense data stays legible; explanatory content gets more breathing room.
- Hebrew RTL and English LTR are equal first-class layouts.
- Color is semantic and restrained; numeric typography signals precision.
- Interaction is immediate, predictable, and recoverable.

## 2. Colors

The palette pairs ink-like canvases and paper-like light themes with one unmistakable billable accent. Theme tokens are semantic, so components never depend on a specific theme name.

### Primary

- **Billable Lime** (`#faff69`): default-theme actions, focus, and the smallest high-value financial highlights.
- **Daylight Gold** (`#d4a900`): accessible light-theme counterpart for actions and focus.

### Secondary

- **Positive Green** (`#22c55e`): completed, paid, and successfully recorded states, always paired with text or an icon.
- **Warning Amber** (`#f59e0b`): incomplete or attention-needed states, never used as the sole signal.
- **Destructive Red** (`#ef4444`): deletion and failed outcomes, reserved for explicit destructive semantics.

### Neutral

- **Midnight Canvas** (`#0a0a0a`): default dark page background.
- **Ledger Surface** (`#121212`): quiet section and app-shell separation.
- **Raised Surface** (`#1a1a1a`): controls, popovers, and grouped content.
- **Active Surface** (`#242424`): hover and selected tonal lift.
- **Warm Paper** (`#f4f4f2`): default light canvas.
- **Ink** (`#1a1a18`): light-theme primary text.
- **Quiet Ink** (`#888888`): secondary dark-theme text; do not use for essential low-size copy without checking contrast.
- **Hairline** (`#2a2a2a`): structural borders and dividers in the default dark theme.

### Named Rules

**The Money Signal Rule.** Accent color marks an action, focus target, or financial state. It never decorates a sentence or fills an entire section without meaning.

## 3. Typography

**Display Font:** Heebo (system UI fallback)
**Body Font:** Heebo (system UI fallback)
**Label/Mono Font:** JetBrains Mono (monospace fallback)

**Character:** Heebo keeps Hebrew and Latin interfaces direct and readable. JetBrains Mono is limited to timers, aligned amounts, and identifiers where stable character width improves scanning.

### Hierarchy

- **Display** (700, `clamp(2.5rem, 6vw, 4rem)`, 1.15): a single landing-page promise or major product moment.
- **Headline** (700, `clamp(1.875rem, 4vw, 2.25rem)`, 1.2): section and page headings.
- **Title** (600, `1.25rem`, 1.35): workflow steps, panels, and grouped content.
- **Body** (400, `1rem`, 1.6): explanatory and form content, capped near 70 characters per line.
- **Label** (500, `0.875rem`, 1.4): controls, navigation, field labels, and compact metadata.
- **Numeric** (600, responsive, tabular): timers, amounts, quantities, and comparative metrics.

### Named Rules

**The Hebrew Rhythm Rule.** Hebrew uses normal letter spacing, generous line height, and visual hierarchy from size and weight. Never add tracking to Hebrew display or body copy.

## 4. Elevation

The system is flat by default. Depth comes from canvas, surface, and active-surface contrast plus one-pixel borders. Shadows are structural only for floating navigation, menus, dialogs, and temporary overlays; ordinary cards remain shadowless.

### Shadow Vocabulary

- **Floating Low** (`0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)`): floating navigation and compact menus.
- **Overlay** (`0 16px 48px rgba(0,0,0,0.28)`): dialogs and sheets when tonal separation is insufficient.

### Named Rules

**The Flat-by-Default Rule.** A shadow must explain layer ownership or temporary elevation. It is never a decorative glow around a static card.

## 5. Components

Components feel tactile and confident: compact inside the product, more spacious on the marketing surface, and always explicit about state.

### Buttons

- **Shape:** 8px controls; pill shapes are reserved for filters, compact status, and the primary marketing CTA.
- **Primary:** semantic primary background, semantic primary foreground, 40px minimum height in product UI and 44px minimum on touch-heavy surfaces.
- **Hover / Focus:** explicit color or opacity transition over 150ms; two-pixel visible focus ring; no `transition: all`.
- **Secondary / Ghost:** tonal or transparent surfaces with clear hover contrast; link-styled controls are used only for navigation.

### Chips

- **Style:** pill radius, compact label, tonal background, and optional leading semantic icon.
- **State:** selected state changes both background and text treatment; status never depends on hue alone.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** card or surface semantic token, never an arbitrary raw color.
- **Shadow Strategy:** flat at rest, following the elevation rules above.
- **Border:** one-pixel semantic border where grouping needs reinforcement.
- **Internal Padding:** 16px for compact product groups, 24px for marketing or explanatory groups.

### Inputs / Fields

- **Style:** 8px radius, semantic card/background surface, one-pixel border, at least 40px high and 16px text on mobile.
- **Focus:** primary border plus visible focus ring.
- **Error / Disabled:** readable inline message and semantic state; disabled controls must still explain why when the reason is not obvious.

### Navigation

Navigation uses Heebo labels, obvious current-state treatment, and 44px touch targets. Desktop marketing navigation may float; authenticated navigation stays anchored to the app shell. Mobile navigation respects safe-area insets and presents no more than the core daily destinations.

### Money Trail

Work, billable items, documents, payments, and outstanding balances are presented as one connected sequence. Amounts use tabular numerals and bidi isolation; completed and outstanding states combine text, iconography, and color.

## 6. Do's and Don'ts

### Do:

- **Do** connect each feature explanation to a user outcome and a financial consequence.
- **Do** use semantic tokens so every component works across all 12 themes.
- **Do** keep body copy near 70 characters per line and use 1.6 line height for explanations.
- **Do** provide loading, success, error, and empty states for every product screen.
- **Do** honor RTL behavior, reduced motion, keyboard navigation, 200% zoom, and 44px touch targets.
- **Do** isolate amounts, times, identifiers, and mixed-direction strings with `<bdi>` or an equivalent bidi-safe treatment.

### Don't:

- **Don't** recreate the coldness of a developer infrastructure dashboard.
- **Don't** import the density and anxiety of enterprise finance software.
- **Don't** build generic SaaS marketing from vague claims, decorative gradients, or interchangeable feature-card grids.
- **Don't** use gradient text, glassmorphism as decoration, nested cards, or colored side-stripe borders.
- **Don't** turn every metric into a hero card or use accent color without semantic meaning.
- **Don't** animate layout properties, use `transition: all`, or require motion to understand state.
- **Don't** hardcode physical left/right layout properties where logical RTL/LTR properties work.
