/**
 * Source-contract guardrails for the customizable dashboard boundaries.
 *
 * The UI refresh may restyle the dashboard, but it must keep reading the
 * user's normalized order/visibility, persist through the profile API, and
 * derive currency from the profile rather than from the active locale.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function run(): void {
  const profileRoute = source("app", "api", "profile", "route.ts");
  const statsRoute = source("app", "api", "dashboard", "stats", "route.ts");
  const dashboardPage = source("app", "[locale]", "dashboard", "page.tsx");
  const customizer = source("components", "dashboard-customizer.tsx");

  assert(
    profileRoute.includes('dashboard_config as "dashboardConfig"'),
    "Profile GET must continue returning the stored dashboard config"
  );
  assert(
    profileRoute.includes("normalizeDashboardConfig(body.dashboardConfig)") &&
      profileRoute.includes("dashboard_config = $${paramIndex++}::jsonb") &&
      profileRoute.includes("JSON.stringify(normalized)"),
    "Profile PATCH must normalize and persist dashboardConfig as JSONB"
  );
  assert(
    statsRoute.includes("normalizeDashboardConfig(earningsResult.rows[0]?.dashboard_config ?? null)") &&
      statsRoute.includes("dashboardConfig,"),
    "Dashboard stats must return a normalized user config"
  );
  assert(
    statsRoute.includes("const userCurrency = earningsResult.rows[0]?.default_currency || 'ILS'") &&
      !statsRoute.includes("locale === \"en\" ? \"USD\" : \"ILS\"") &&
      !statsRoute.includes("locale === 'en' ? 'USD' : 'ILS'"),
    "Dashboard currency must come from the profile, never from locale"
  );
  assert(
    dashboardPage.includes("setDashboardConfig(normalizeDashboardConfig(data.dashboardConfig))") &&
      dashboardPage.includes("dashboardConfig.cards.filter") &&
      dashboardPage.includes("dashboardConfig.sections.filter"),
    "Dashboard rendering must honor normalized card and section visibility"
  );
  assert(
    customizer.includes("normalizeDashboardConfig(profile.dashboardConfig)") &&
      customizer.includes("{ dashboardConfig: next }") &&
      customizer.includes('formatCurrency(sampleValue, profile?.defaultCurrency ?? "ILS", locale)'),
    "Dashboard customizer must load/save the shared config and preview the profile currency"
  );

  console.log("✅ dashboard-api-contract: persistence, rendering, and currency guardrails pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ dashboard-api-contract:", error instanceof Error ? error.message : error);
  process.exit(1);
}
