# UI Polish Pass — ClockBill (mobile + desktop)

> Date: 2026-06-14 · Branch: `design/ui-polish-pass`
> Goal: remove the "clunky / not modern" feel across the app (mobile-first, desktop too) and tighten branding. Audit-first, then fix in batches with before/after screenshots. Verified live in a 390px iframe (real mobile breakpoints) + full-window desktop.

## Root causes (systemic — fix once, app-wide impact)

### S1 — Tab component chaos → the "hand-drawn" curved underline
Three different tab styles coexist (Settings = wrapping pills, Tasks = segmented pills, Reports = boxed). On top, `app/[locale]/accessibility.css:266` globally forces `border-bottom: 2px solid` on every `[role="tab"][aria-selected="true"]`, while the JSX styles the active tab as `rounded-full`. A bottom-border on a pill renders as a **curved arc** — the "hand-drawn" look. Two styling systems collide.
- **Fix:** one shared `<Tabs>` component (chosen style: **segmented control** — subtle gray track, active = filled pill, horizontal scroll on mobile, never wrap). Remove the cosmetic global `[role="tab"]` / `[role="tablist"]` rules in `accessibility.css` (keep only `:focus-visible`). Migrate Settings, Tasks, Reports to the shared component.
- Files: `app/[locale]/accessibility.css:250-276`, `app/[locale]/settings/page.tsx:748`, tasks tabs, reports tabs.

### S2 — Timer-start affordance overload (mobile)
Up to 4 simultaneous ways to start a timer per mobile screen: top CTA bar, floating FAB, per-page button.
- **Fix:** one primary mobile entry. Keep the FAB; hide the top CTA bar on mobile when no timer runs. Files: `persistent-timer-bar.tsx`, `app-layout.tsx`.

### S3 — FAB overlaps interactive content
FAB (bottom-end) covers "העלה חתימה" in Settings and card edges on Dashboard.
- **Fix:** reposition / scroll-padding so it never sits over an interactive control. File: `timer-fab.tsx`, `app-layout.tsx`.

### S4 — Emoji used as UI status
`✅ ⏳ 🔔` as status indicators / in buttons (Settings → Notifications). Inconsistent cross-platform, reads unfinished.
- **Fix:** lucide icons + semantic colored badge.

### S5 — Native date/month inputs
`<input type="month">` renders LTR ("June 2026"), misplaced calendar icon, clashes with custom selects (Entries, Reports).
- **Fix:** styled, RTL-correct month picker consistent with `SimpleSelect`.

### S6 — Card heaviness / hierarchy
Heavy white cards, large padding, wasted space; inverted metric hierarchy on the dashboard; weak empty states.
- **Fix:** tighten spacing, consistent card tokens, real empty states.

### S7 — Decorative "starburst" behind dashboard quick-action buttons — reads as an artifact. Remove or make intentional.

### S8 — Logout placement/styling — mobile top-bar link; desktop red destructive at sidebar bottom. Logout isn't destructive. Move under avatar menu / neutral styling.

## Per-screen (mobile)
- **Dashboard:** hero metric (סך הכנסות) shown as a thin bar while lesser metrics get big cards — invert hierarchy.
- **Clients:** count+plan line wastes a card; two clients share one container (divider only); cramped metric row; inactive name still gold.
- **Tasks:** lots of empty space; tabs.
- **Entries/Reports:** see S5/S6.

## Per-screen (desktop)
- Centered headings ("ברוך הבא!", Settings, Reports) — inconsistent with RTL right-align.
- Starburst (S7); month input (S5); large empty states.

## Branding
- Logo (stopwatch + play, `components/brand-mark.tsx`) is clean & consistent. Verify favicon/apple-icon/manifest match; consolidate `public/logos/`.

## Batch plan (sequential, approval between batches)
1. **Batch 1 — systemic roots:** S1 (unified segmented tabs) + S2 + S3.
2. **Batch 2 — component polish:** S4 + S5 + S6.
3. **Batch 3 — polish:** S7 + S8 + desktop heading alignment + per-screen mobile.
4. **Batch 4 — branding:** logo asset consistency.

## Verification
Each change verified live: 390px iframe for mobile breakpoints, full-window for desktop, before/after screenshots. No regressions to existing themes (12 themes, 6 light/6 dark) — tabs/cards must use design tokens, not hardcoded colors.
