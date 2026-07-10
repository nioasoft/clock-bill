# Implementation Tasks

## Phase 0: contracts and baseline

- [ ] Lock dashboard configuration behavior with regression tests.
- [ ] Add locale, currency, RTL, and viewport acceptance checks.
- [ ] Record baseline screenshots with fixture-safe data.

## Phase 1: interface foundation

- [ ] Polish buttons, icon buttons, dialogs, tabs, selects, fields, toasts, and empty states.
- [ ] Standardize 44px frequent-action targets and at least 24px all pointer targets.
- [ ] Replace broad transitions with property-specific transitions.
- [ ] Improve page rhythm, focus visibility, reduced motion, and safe areas.
- [ ] Polish desktop and mobile navigation plus the persistent timer bar.

## Phase 2: public conversion and activation

- [ ] Shorten and clarify marketing without losing the money-trail story.
- [ ] Connect pricing to the site shell and improve comparison and trust.
- [ ] Polish login, registration, password reset, success, and expired-link states.
- [ ] Add a persistent activation checklist while preserving skip and resume.

## Phase 3: fast work capture

- [ ] Introduce shared quick capture with recent context.
- [ ] Keep advanced time/item fields progressively disclosed.
- [ ] Polish timer start, active, notes, pause, resume, and stop states.
- [ ] Improve entry filters, table/mobile list, edit, empty, and error states.
- [ ] Add task inline quick-add and progressive advanced fields.
- [ ] Polish clients and projects without changing their API contracts.

## Phase 4: billing and collection

- [ ] Add a guided billing step indicator over existing report capabilities.
- [ ] Make missing data and disabled next actions explicit.
- [ ] Improve document lifecycle, payment feedback, and public document trust.
- [ ] Add reconciliation and outstanding reminder workflows safely.
- [ ] Add recurring work templates with explicit review before entry creation.

## Phase 5: settings and secondary surfaces

- [ ] Split settings into task-based components and navigation.
- [ ] Preserve DashboardCustomizer without behavioral changes.
- [ ] Add dirty-state and save feedback where safe.
- [ ] Polish feedback, contact, admin, accessibility, legal, offline, not-found, trial, and upgrade states.

## Phase 6: advanced approved capabilities

- [ ] Add reviewed CSV capture inbox.
- [ ] Extend the scoped public-document flow toward a client portal.
- [ ] Make base/document/client currency policy explicit.
- [ ] Add reviewed payment matching.
- [ ] Extend global search into safe actions.
- [ ] Add actionable insights based on existing data.

## Final gates

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e`
- [ ] Hebrew and English browser pass at 375, 768, and 1280.
- [ ] Keyboard, focus, screen-reader semantics, contrast, reduced motion, and overflow review.
- [ ] All 12 themes sampled and PDF treated as a separate print system.
- [ ] Security review, dependency audit, secret scan, diff review, and rollback notes.
