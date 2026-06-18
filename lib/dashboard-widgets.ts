/**
 * Single source of truth for the customizable dashboard.
 *
 * A user's dashboard layout is stored as an ordered, show/hide list of widgets
 * (the `dashboard_config` jsonb column on user_profiles). This file owns the
 * widget catalog, the default layout (which mirrors the pre-customization
 * dashboard so existing users see no change), the quick-start presets, and the
 * server-side normalizer that validates an untrusted config against the
 * catalog. Mirrors the pattern in lib/themes.ts.
 *
 * Two zones render in structurally different containers, so they are tracked
 * separately: `cards` (the top stat-card grid) and `sections` (the stacked
 * charts / recent-entries blocks). Functional blocks (running timers, quick
 * actions, getting-started, deadlines) are NOT customizable and live only in
 * the dashboard page.
 */
import { z } from "zod";

export type WidgetKind = "card" | "section";

export interface DashboardWidgetMeta {
  id: string;
  /** i18n key under the "Dashboard" message namespace (used by the dashboard
   *  render AND the settings customizer, so labels stay in one place). */
  labelKey: string;
  kind: WidgetKind;
  /** Accent (highlighted) styling — only the total-revenue card. */
  accent?: boolean;
}

/** The catalog. Adding a widget = one entry here + its render in the registry
 *  (dashboard page) + an i18n key. `normalizeDashboardConfig` then appends the
 *  new widget (hidden) to every existing user's stored config automatically. */
export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  // Cards — top stat row. Revenue is offered per period (today / week / month)
  // and per billing kind (total / from hours / from items) so the user can show
  // any combination; "from items" = non-hourly billing-item revenue.
  { id: "hoursToday", labelKey: "stats.todayHours", kind: "card" },
  { id: "revenueToday", labelKey: "stats.revenueToday", kind: "card" },
  { id: "revenueTodayByHours", labelKey: "stats.revenueTodayByHours", kind: "card" },
  { id: "revenueTodayByItems", labelKey: "stats.revenueTodayByItems", kind: "card" },
  { id: "hoursWeek", labelKey: "stats.weekHours", kind: "card" },
  { id: "revenueWeek", labelKey: "stats.revenueWeek", kind: "card" },
  { id: "revenueWeekByHours", labelKey: "stats.revenueWeekByHours", kind: "card" },
  { id: "revenueWeekByItems", labelKey: "stats.revenueWeekByItems", kind: "card" },
  { id: "hoursMonth", labelKey: "stats.monthHours", kind: "card" },
  { id: "revenueMonth", labelKey: "stats.totalEarnings", kind: "card", accent: true },
  { id: "revenueByHours", labelKey: "stats.earningsByHours", kind: "card" },
  { id: "revenueByItems", labelKey: "stats.earningsByItems", kind: "card" },
  { id: "clientsCount", labelKey: "stats.clientsCount", kind: "card" },
  { id: "projectsCount", labelKey: "stats.projectsCount", kind: "card" },
  // Sections — lower stacked blocks
  { id: "earningsChart", labelKey: "earningsChart.title", kind: "section" },
  { id: "projectHours", labelKey: "projectHoursChart.title", kind: "section" },
  { id: "recentEntries", labelKey: "recentEntries.title", kind: "section" },
];

export type WidgetId = (typeof DASHBOARD_WIDGETS)[number]["id"];

const CARD_IDS: string[] = DASHBOARD_WIDGETS.filter((w) => w.kind === "card").map((w) => w.id);
const SECTION_IDS: string[] = DASHBOARD_WIDGETS.filter((w) => w.kind === "section").map((w) => w.id);

export interface DashboardWidgetState {
  id: string;
  visible: boolean;
}

export interface DashboardConfig {
  version: 1;
  cards: DashboardWidgetState[];
  sections: DashboardWidgetState[];
}

export function getWidgetMeta(id: string): DashboardWidgetMeta | undefined {
  return DASHBOARD_WIDGETS.find((w) => w.id === id);
}

export function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && DASHBOARD_WIDGETS.some((w) => w.id === value);
}

/**
 * Build a complete, ordered widget list for one zone: the `visible` ids first
 * (in the given order), then every remaining catalog id appended hidden, in
 * catalog order. Guarantees completeness + de-dup so configs are always valid.
 */
function buildList(allIds: string[], visible: string[]): DashboardWidgetState[] {
  const visibleSet = new Set(visible.filter((id) => allIds.includes(id)));
  const orderedVisible = visible.filter((id) => visibleSet.has(id));
  const seen = new Set<string>();
  const result: DashboardWidgetState[] = [];
  for (const id of [...orderedVisible, ...allIds]) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, visible: visibleSet.has(id) });
  }
  return result;
}

function buildConfig(visibleCards: string[], visibleSections: string[]): DashboardConfig {
  return {
    version: 1,
    cards: buildList(CARD_IDS, visibleCards),
    sections: buildList(SECTION_IDS, visibleSections),
  };
}

/** Deep copy so callers can mutate freely without touching the shared default. */
export function cloneConfig(config: DashboardConfig): DashboardConfig {
  return {
    version: 1,
    cards: config.cards.map((c) => ({ ...c })),
    sections: config.sections.map((s) => ({ ...s })),
  };
}

/**
 * The default layout — exactly the pre-customization dashboard. A NULL stored
 * config means "use this", so existing users see zero change (no backfill).
 */
export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = buildConfig(
  ["hoursToday", "hoursWeek", "hoursMonth", "revenueToday", "revenueMonth"],
  ["earningsChart", "projectHours", "recentEntries"]
);

export interface DashboardPreset {
  id: string;
  /** i18n key under "Settings.dashboard.presets". */
  labelKey: string;
  config: DashboardConfig;
}

/** Quick-start presets shown as buttons in the customizer. */
export const DASHBOARD_PRESETS: DashboardPreset[] = [
  { id: "default", labelKey: "default", config: DEFAULT_DASHBOARD_CONFIG },
  {
    id: "todayFocus",
    labelKey: "todayFocus",
    config: buildConfig(
      ["hoursToday", "revenueToday", "hoursWeek", "revenueWeek"],
      ["recentEntries"]
    ),
  },
  {
    id: "monthlyFocus",
    labelKey: "monthlyFocus",
    config: buildConfig(
      ["hoursWeek", "hoursMonth", "revenueWeek", "revenueMonth"],
      ["earningsChart", "recentEntries"]
    ),
  },
  {
    id: "byProject",
    labelKey: "byProject",
    config: buildConfig(
      ["projectsCount", "clientsCount", "hoursMonth", "revenueMonth"],
      ["projectHours", "earningsChart"]
    ),
  },
];

const widgetStateSchema = z.object({ id: z.string(), visible: z.boolean() });
const dashboardConfigSchema = z.object({
  version: z.literal(1),
  cards: z.array(widgetStateSchema),
  sections: z.array(widgetStateSchema),
});

/** Keep known ids in their stored order (de-duped), then append any missing
 *  catalog ids hidden — this is how a newly added widget appears (hidden) for
 *  every existing user without a data migration. */
function normalizeList(allIds: string[], stored: DashboardWidgetState[]): DashboardWidgetState[] {
  const known = new Set(allIds);
  const seen = new Set<string>();
  const result: DashboardWidgetState[] = [];
  for (const s of stored) {
    if (known.has(s.id) && !seen.has(s.id)) {
      seen.add(s.id);
      result.push({ id: s.id, visible: Boolean(s.visible) });
    }
  }
  for (const id of allIds) {
    if (!seen.has(id)) result.push({ id, visible: false });
  }
  return result;
}

/**
 * Validate + normalize an untrusted dashboard config (from the DB or a client
 * PATCH). Unknown/removed ids are dropped, missing ids appended hidden, a bad
 * shape falls back to the default, and at least one card is always visible.
 * Runs on both read and write — never trust the stored blob.
 */
export function normalizeDashboardConfig(raw: unknown): DashboardConfig {
  // NULL/undefined = "never customized" → use the default layout.
  if (raw === null || raw === undefined) return cloneConfig(DEFAULT_DASHBOARD_CONFIG);

  const parsed = dashboardConfigSchema.safeParse(raw);
  if (!parsed.success) return cloneConfig(DEFAULT_DASHBOARD_CONFIG);

  let cards = normalizeList(CARD_IDS, parsed.data.cards);
  const sections = normalizeList(SECTION_IDS, parsed.data.sections);

  // A dashboard with no visible cards reads as broken — fall back to default
  // cards (defense in depth; the editor also blocks hiding the last card).
  if (!cards.some((c) => c.visible)) {
    cards = cloneConfig(DEFAULT_DASHBOARD_CONFIG).cards;
  }

  return { version: 1, cards, sections };
}
