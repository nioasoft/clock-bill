import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function run(): void {
  const settings = source("app", "[locale]", "settings", "page.tsx");
  const sectionNav = source("components", "settings", "settings-section-nav.tsx");
  const dashboardCustomizer = source("components", "dashboard-customizer.tsx");

  assert(
    settings.includes("<SettingsSectionNav") &&
      settings.includes("sectionNavItems[activeTab]") &&
      sectionNav.includes('href={`#${item.id}`}'),
    "Settings must expose task-based, linkable section navigation"
  );
  for (const id of [
    "settings-business",
    "settings-pdf",
    "settings-theme",
    "settings-dashboard",
    "settings-display",
    "settings-plan",
    "settings-notifications",
    "settings-security",
    "settings-data",
  ]) {
    assert(settings.includes(`id=\"${id}\"`), `Settings section is missing its ${id} anchor`);
  }
  assert(
    settings.includes('url.searchParams.set("tab", nextTab)') &&
      settings.includes("window.history.replaceState") &&
      settings.includes("scrollIntoView"),
    "Settings tabs and section anchors must survive refresh and deep links"
  );
  assert(
    settings.includes('className={`fixed bottom-20 end-4') &&
      settings.includes('role={sectionResult && !sectionResult.ok ? "alert" : "status"}'),
    "Long settings forms must keep save feedback visible"
  );
  assert(
    settings.includes("[&_button]:min-h-11") &&
      sectionNav.includes("min-h-11") &&
      dashboardCustomizer.includes('className="flex h-11 w-11'),
    "Settings controls and dashboard editor actions must keep touch-friendly targets"
  );
  assert(
    dashboardCustomizer.includes("patchProfile.isPending || saved || saveError") &&
      dashboardCustomizer.includes("aria-live=\"polite\""),
    "Dashboard autosave feedback must remain visible and announced"
  );
  assert(!settings.includes("transition-all"), "Settings must transition explicit properties only");
  assert(!dashboardCustomizer.includes("transition-all"), "Dashboard customizer must transition explicit properties only");

  console.log("✅ settings-experience: navigation, feedback, and touch guardrails pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ settings-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
