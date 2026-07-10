# UX Refresh Architecture

## Layers

### Shared interface primitives

`components/ui/*`, global theme tokens, page containers, headers, dialogs, navigation, empty states, and feedback components define the interaction contract for every surface. Shared primitives are changed before feature pages.

### Workflow modules

- Capture: timer start/stop, manual time, billable item, recent context.
- Work management: tasks, clients, projects, entries.
- Billing: work selection, validation, document preview, send, payment.
- Activation: onboarding checklist derived from existing data.
- Settings: task-based sections around the existing profile API.

### Data and security

- Existing object ownership and user scoping remain mandatory.
- Boundary inputs use existing shared Zod schemas or new schemas under `lib/schemas`.
- New persisted workflow state requires migration-first development, RLS review, rollback notes, and dev verification before production.
- Client-only preferences use a versioned local-storage schema and never store sensitive client details.

## Dashboard compatibility boundary

The following are treated as public contracts and are not changed:

- `lib/dashboard-widgets.ts`
- `DashboardConfig` JSON shape
- `DashboardCustomizer` persistence behavior
- `/api/profile` dashboard configuration fields
- `/api/dashboard/stats` configuration response

Visual wrappers may change, but render order and visibility continue to come exclusively from the normalized stored configuration.

## Internationalization boundary

- All new copy is added to both `messages/he.json` and `messages/en.json` in the same commit.
- Direction comes from the locale root.
- Layout uses logical properties.
- Unknown-direction user content uses `bdi` or `dir="auto"`.
- Currency comes from client, document, or profile data, never inferred from locale.

## State contract

Every data-driven surface explicitly handles loading, success, error, and empty states. Mutations add pending feedback, durable confirmation, duplicate-submit protection, and recovery appropriate to risk.

## Verification gates

Each phase runs focused tests, lint, and typecheck. Milestone gates run the full unit suite and build. Final verification adds authenticated E2E, three viewports, keyboard paths, both locales, representative themes, PDF output, dependency audit, secret scan, and final diff review.
