/**
 * Unit tests for lib/dashboard-widgets.ts — the normalizer is the trust
 * boundary for a user's stored dashboard layout, so it gets the coverage.
 */
import {
  normalizeDashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
  DASHBOARD_WIDGETS,
  isWidgetId,
  type DashboardConfig,
} from "../../lib/dashboard-widgets";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running dashboard-widgets tests...\n");
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

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}

const ALL_CARD_IDS = DASHBOARD_WIDGETS.filter((w) => w.kind === "card").map((w) => w.id);
const ALL_SECTION_IDS = DASHBOARD_WIDGETS.filter((w) => w.kind === "section").map((w) => w.id);

const runner = new TestRunner();

runner.test("null → default layout", () => {
  const c = normalizeDashboardConfig(null);
  assertEqual(JSON.stringify(c), JSON.stringify(DEFAULT_DASHBOARD_CONFIG), "null should clone default");
});

runner.test("undefined → default layout", () => {
  const c = normalizeDashboardConfig(undefined);
  assertEqual(c.cards.length, ALL_CARD_IDS.length, "should have all cards");
});

runner.test("garbage / wrong shape → default", () => {
  for (const bad of [42, "nope", {}, { version: 1 }, { version: 2, cards: [], sections: [] }, []]) {
    const c = normalizeDashboardConfig(bad);
    assertEqual(c.version, 1 as const, "version is 1");
    assert(c.cards.some((x) => x.visible), `default has a visible card (input: ${JSON.stringify(bad)})`);
  }
});

runner.test("unknown ids are dropped", () => {
  const input: DashboardConfig = {
    version: 1,
    cards: [
      { id: "hoursToday", visible: true },
      { id: "totallyMadeUp", visible: true },
    ],
    sections: [{ id: "ghostSection", visible: true }],
  };
  const c = normalizeDashboardConfig(input);
  assert(!c.cards.some((x) => x.id === "totallyMadeUp"), "unknown card dropped");
  assert(!c.sections.some((x) => x.id === "ghostSection"), "unknown section dropped");
});

runner.test("missing ids are appended hidden, in catalog order", () => {
  const input: DashboardConfig = {
    version: 1,
    cards: [{ id: "hoursMonth", visible: true }],
    sections: [],
  };
  const c = normalizeDashboardConfig(input);
  // All catalog ids present.
  assertEqual(c.cards.length, ALL_CARD_IDS.length, "all card ids present");
  assertEqual(c.sections.length, ALL_SECTION_IDS.length, "all section ids present");
  // The stored one stays first and visible.
  assertEqual(c.cards[0].id, "hoursMonth", "stored card stays first");
  assertEqual(c.cards[0].visible, true, "stored card stays visible");
  // Appended ones are hidden.
  assert(
    c.cards.slice(1).every((x) => x.visible === false),
    "appended cards are hidden"
  );
  assert(c.sections.every((x) => x.visible === false), "all sections appended hidden");
});

runner.test("stored order is preserved for known ids", () => {
  const input: DashboardConfig = {
    version: 1,
    cards: [
      { id: "revenueMonth", visible: true },
      { id: "hoursToday", visible: true },
    ],
    sections: [
      { id: "recentEntries", visible: true },
      { id: "earningsChart", visible: true },
    ],
  };
  const c = normalizeDashboardConfig(input);
  assertEqual(c.cards[0].id, "revenueMonth", "first stored card kept first");
  assertEqual(c.cards[1].id, "hoursToday", "second stored card kept second");
  assertEqual(c.sections[0].id, "recentEntries", "section order preserved");
  assertEqual(c.sections[1].id, "earningsChart", "section order preserved");
});

runner.test("duplicate ids are de-duped (first wins)", () => {
  const input: DashboardConfig = {
    version: 1,
    cards: [
      { id: "hoursToday", visible: true },
      { id: "hoursToday", visible: false },
    ],
    sections: [],
  };
  const c = normalizeDashboardConfig(input);
  const occurrences = c.cards.filter((x) => x.id === "hoursToday");
  assertEqual(occurrences.length, 1, "id appears once");
  assertEqual(occurrences[0].visible, true, "first occurrence wins");
});

runner.test("zero visible cards → falls back to default cards", () => {
  const allHidden: DashboardConfig = {
    version: 1,
    cards: ALL_CARD_IDS.map((id) => ({ id, visible: false })),
    sections: [{ id: "earningsChart", visible: true }],
  };
  const c = normalizeDashboardConfig(allHidden);
  assert(c.cards.some((x) => x.visible), "at least one card visible after normalize");
  // Sections may be fully customized (the user's section choice is respected).
  assertEqual(c.sections[0].id, "earningsChart", "section choice respected");
});

runner.test("sections may all be hidden (allowed)", () => {
  const input: DashboardConfig = {
    version: 1,
    cards: [{ id: "hoursToday", visible: true }],
    sections: ALL_SECTION_IDS.map((id) => ({ id, visible: false })),
  };
  const c = normalizeDashboardConfig(input);
  assert(c.sections.every((x) => !x.visible), "all sections stay hidden");
});

runner.test("isWidgetId allow-list", () => {
  assertEqual(isWidgetId("hoursToday"), true, "known id");
  assertEqual(isWidgetId("nope"), false, "unknown id");
  assertEqual(isWidgetId(123), false, "non-string");
});

runner.test("default config is internally complete & valid", () => {
  assert(DEFAULT_DASHBOARD_CONFIG.cards.some((c) => c.visible), "default has visible cards");
  assertEqual(DEFAULT_DASHBOARD_CONFIG.cards.length, ALL_CARD_IDS.length, "default lists every card");
  // Idempotent: normalizing the default returns the default.
  assertEqual(
    JSON.stringify(normalizeDashboardConfig(DEFAULT_DASHBOARD_CONFIG)),
    JSON.stringify(DEFAULT_DASHBOARD_CONFIG),
    "normalize is idempotent on default"
  );
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
