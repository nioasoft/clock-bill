# Claude Design prompt — Monit theme set

Use this in **Claude Design** to produce the curated palettes. Output feeds Task 9 of the
implementation plan (it only fills token VALUES — names are fixed).

## What to attach / point Claude Design at

1. **Point it at this repo** (Claude Design reads codebase + design files during onboarding), or
   at minimum paste the token list below.
2. **A screenshot of the live app** for each key surface (dashboard with stat cards + running
   timer, an entries table, the pricing page) so it designs on real UI. Capture from
   `https://clock-bill.com` (dark) — use the web-capture tool if available.

## The prompt (paste this)

> I'm designing a curated set of color themes for **Monit**, a Hebrew/RTL time-tracking web app.
> The current design is a single dark theme — "ClickHouse-inspired": near-black canvas, electric
> **yellow** accent (#faff69), white type, **hairline 1px borders**, and **NO drop shadows** (depth
> comes only from canvas/surface contrast). Numbers use a monospace font. Layout is RTL.
>
> I need **3–4 complete themes** as full token packages. Keep the existing dark as-is, and design
> the rest to the SAME structure. For EACH theme, give me a hex value for **every** token in this list:
>
> `background, foreground, surface, card, card-foreground, card-elevated, muted, muted-foreground,
> border, border-strong, input, popover, popover-foreground, sidebar, sidebar-foreground, primary,
> primary-foreground, primary-light, primary-active, accent, accent-foreground, ring, destructive,
> destructive-foreground, success, success-foreground, warning, warning-foreground, running,
> running-foreground` — plus whether the theme's `color-scheme` is light or dark. (`warning` =
> amber "paused/attention", `running` = green "active timer" — give light-theme-appropriate values
> that pass AA; a theme may keep the dark defaults if they already pass on its background.)
>
> The themes:
> 1. **Midnight** — the current dark (keep: background #0a0a0a, accent #faff69, card #1a1a1a,
>    border #2a2a2a). This is the baseline; the others are alternatives to it.
> 2. **Daylight** — a clean light theme.
> 3. **(your call)** 1–2 more on-brand options — e.g. a softer/warmer dark, and/or a warm "paper"
>    light. Surprise me, but stay in the family.
>
> Hard constraints for every theme:
> - **WCAG AA**: body text ≥ 4.5:1 against its background; large text/UI ≥ 3:1.
> - **Hairline borders, no shadows** — borders must be visible against both card and canvas.
> - **The accent problem**: electric yellow #faff69 is illegible on light backgrounds. For any
>   light theme, design a deliberate accent (e.g. a deep gold/amber) that keeps the energetic feel
>   but passes contrast, and pick `*-foreground` so text on the accent is readable.
> - Keep `primary` and `accent` the same hue within a theme (the app uses a single accent system).
> - Don't change radius, fonts, spacing — colors only.
>
> Show each theme applied to a sample dashboard (a stat card, a running-timer chip, a table row, a
> primary button, a secondary button, a subtle banner). Then output a copy-pasteable list of
> `--token: #hex;` lines per theme so I can drop them straight into CSS.

## After Claude Design

Bring back the per-theme `--token: #hex;` lists. They become `[data-theme="id"]` delta blocks in
`app/[locale]/themes.css` and `swatch`/labels in `lib/themes.ts` (Task 9). Re-check AA in-app on
real screens before shipping.
