# ClockBill Product UX Refresh

## Objective

Make ClockBill faster, clearer, more polished, and more accessible across the complete journey from marketing through collection, while preserving existing behavior and the configurable dashboard card contract.

## Confirmed scope

- Polish the shared visual system, controls, spacing, typography, focus states, and responsive behavior.
- Improve marketing, pricing, authentication, onboarding, capture, timers, entries, tasks, clients, projects, billing, reports, documents, payments, settings, public documents, legal, offline, error, and admin surfaces.
- Preserve Hebrew RTL and English LTR as equal product experiences.
- Preserve currency as an independent business setting. Locale must never determine stored or document currency.
- Add safe workflow improvements in incremental commits: recent-context capture, activation checklist, guided billing, reconciliation, reminders, recurring work, and approved follow-up capabilities.

## Explicit non-goal

Do not replace, remove, reorder, or change the persistence of the dashboard cards selected through Settings. `DashboardConfig`, presets, visibility, ordering, API payloads, and default configuration are frozen. Dashboard work is limited to visual polish, accessibility, responsive layout, and the existing selected content.

## Users

1. A new freelancer who needs an obvious route to first value.
2. A frequent user who needs fast capture with remembered context.
3. A mobile user who has seconds to record completed work.
4. A keyboard or assistive-technology user who needs predictable, complete flows.

## Product principles

1. Capture first, details when needed.
2. Every mutation gives immediate feedback and a recovery path.
3. Work, billing, documents, and payments stay visibly connected.
4. Empty states teach the next action.
5. Financial data is explicit, bidi-safe, locale-aware, and trustworthy.
6. Existing API authorization and user scoping remain defense in depth.

## Success metrics

- First work entry in under 10 minutes for a new account.
- Quick capture completed in under 15 seconds on mobile.
- Fewer incomplete entries and timers left running unintentionally.
- Shorter time from completed work to sent charge document.
- No horizontal overflow at 375, 768, or 1280 CSS pixels.
- Keyboard completion of all primary flows.
- No missing Hebrew or English message keys.
- No regression in dashboard customization, currency formatting, API authorization, or PDF output.

## Release policy

All work stays on `codex/product-ux-refresh-2026-07` in the isolated worktree until the user reviews it. Development database migrations precede any production migration. Each phase has an independently revertible conventional commit.
