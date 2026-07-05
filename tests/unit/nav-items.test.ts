/**
 * Unit tests for lib/nav-items.ts
 * Guards the mobile bottom-nav item set so the bar stays minimal (4 tabs).
 */

import { navItemDefs } from "../../lib/nav-items";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running nav-items.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (error instanceof Error) console.error(`     ${error.message}`);
      }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) throw new Error(msg || `Expected "${expected}" but got "${actual}"`);
}

const runner = new TestRunner();

// Mirrors the filter in mobile-bottom-nav.tsx.
const mobileVisible = navItemDefs
  .filter((i) => !i.adminOnly && !i.mobileHidden)
  .map((i) => i.labelKey);

runner.test("mobile bottom nav shows exactly 4 tabs", () => {
  assertEqual(mobileVisible.join(","), ["dashboard", "entries", "tasks", "settings"].join(","));
});

runner.test("clients + reports are hidden from the mobile bottom nav", () => {
  const hidden = navItemDefs.filter((i) => i.mobileHidden).map((i) => i.labelKey);
  assertEqual(hidden.includes("clients"), true, "clients should be mobileHidden");
  assertEqual(hidden.includes("reports"), true, "reports should be mobileHidden");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
