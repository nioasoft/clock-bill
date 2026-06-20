import { getTrialPillView } from "../../lib/trial-view";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-view tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m ?? `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
const runner = new TestRunner();

runner.test("null trial -> null", () => assertEqual(getTrialPillView(null), null));
runner.test("inactive trial -> null", () => assertEqual(getTrialPillView({ active: false, daysLeft: 0, endsAt: null }), null));
runner.test("active trial 11 days -> show, not ending", () => assertEqual(getTrialPillView({ active: true, daysLeft: 11, endsAt: "x" }), { show: true, daysLeft: 11, ending: false }));
runner.test("active trial 3 days -> ending", () => assertEqual(getTrialPillView({ active: true, daysLeft: 3, endsAt: "x" }), { show: true, daysLeft: 3, ending: true }));
runner.test("active trial 1 day -> ending", () => assertEqual(getTrialPillView({ active: true, daysLeft: 1, endsAt: "x" }), { show: true, daysLeft: 1, ending: true }));

runner.run();
