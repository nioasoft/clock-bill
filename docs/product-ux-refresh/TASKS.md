# Implementation Tasks

## Phase 0: contracts and baseline

- [x] Lock dashboard configuration behavior with regression tests.
- [x] Add locale, currency, RTL, and viewport acceptance checks.
- [x] Record baseline screenshots with fixture-safe data.

## Phase 1: interface foundation

- [x] Polish buttons, icon buttons, dialogs, tabs, selects, fields, toasts, and empty states.
- [x] Standardize 44px frequent-action targets and at least 24px all pointer targets.
- [x] Replace broad transitions with property-specific transitions.
- [x] Improve page rhythm, focus visibility, reduced motion, and safe areas.
- [x] Polish desktop and mobile navigation plus the persistent timer bar.

## Phase 2: public conversion and activation

- [x] Shorten and clarify marketing without losing the money-trail story.
- [x] Connect pricing to the site shell and improve comparison and trust.
- [x] Polish login, registration, password reset, success, and expired-link states.
- [x] Add a persistent activation checklist while preserving skip and resume.

## Phase 3: fast work capture

- [x] Introduce shared quick capture with recent context.
- [x] Keep advanced time/item fields progressively disclosed.
- [x] Polish timer start, active, notes, pause, resume, and stop states.
- [x] Improve entry filters, table/mobile list, edit, empty, and error states.
- [x] Add task inline quick-add and progressive advanced fields.
- [x] Polish clients and projects without changing their API contracts.

## Phase 4: billing and collection

- [x] Add a guided billing step indicator over existing report capabilities.
- [x] Make missing data and disabled next actions explicit.
- [x] Improve document lifecycle, payment feedback, and public document trust.
- [x] Add reconciliation and outstanding reminder workflows safely.
- [x] Add recurring work templates with explicit review before entry creation.

## Phase 5: settings and secondary surfaces

- [x] Split settings into task-based components and navigation.
- [x] Preserve DashboardCustomizer without behavioral changes.
- [x] Add dirty-state and save feedback where safe.
- [x] Polish feedback, contact, admin, accessibility, legal, offline, not-found, trial, and upgrade states.

## Phase 6: advanced approved capabilities

- [x] Add reviewed CSV capture inbox.
- [x] Extend the scoped public-document flow toward a client portal.
- [x] Make base/document/client currency policy explicit.
- [x] Add reviewed payment matching.
- [x] Extend global search into safe actions.
- [x] Add actionable insights based on existing data.

## Final gates

- [x] `npm run lint`
- [x] `npx tsc --noEmit`
- [x] `npm test`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] Hebrew and English browser pass at 375, 768, and 1280.
- [x] Keyboard, focus, screen-reader semantics, contrast, reduced motion, and overflow review.
- [x] All 12 themes sampled and PDF treated as a separate print system.
- [x] Security review, dependency audit, secret scan, diff review, and rollback notes.

## Verification and rollback record

- Verified on 2026-07-11 from the isolated `codex/product-ux-refresh-2026-07` worktree.
- The complete migration chain, including `0036` and `0037`, was applied only to the isolated local `clockbill_refresh` development database. The unidentified external Neon target and production were not modified.
- Roll back application work by removing the isolated worktree/branch. Roll back the disposable migration check with `dropdb clockbill_refresh`; no shared environment requires reversal.
- The build is green with one pre-existing Turbopack NFT tracing warning from `lib/storage.ts` via the profile signature route.
