/** Unit tests for resolvePlan (pure plan-state resolution). */
import { resolvePlan, type PlanRow } from "../../lib/entitlements";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running resolvePlan tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message ?? `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const runner = new TestRunner();
const NOW = new Date("2026-06-25T00:00:00.000Z");
const base: PlanRow = { subscription_tier: "free", subscription_status: null, subscription_period_end: null, founding: false, trial_ends_at: null };

runner.test("founding -> unlimited, no trial", () => {
  const p = resolvePlan({ ...base, founding: true }, NOW);
  assertEqual(p.tier, "unlimited"); assertEqual(p.founding, true); assertEqual(p.trial, null);
});
runner.test("paid starter -> starter, no trial", () => {
  const p = resolvePlan({ ...base, subscription_tier: "starter" }, NOW);
  assertEqual(p.tier, "starter"); assertEqual(p.trial, null);
});
runner.test("active trial -> unlimited + trial.active", () => {
  const p = resolvePlan({ ...base, trial_ends_at: "2026-06-30T00:00:00.000Z" }, NOW);
  assertEqual(p.tier, "unlimited");
  assertEqual(p.trial?.active, true);
  assertEqual(p.trial?.daysLeft, 5);
});
runner.test("expired trial -> free + trial.active false", () => {
  const p = resolvePlan({ ...base, trial_ends_at: "2026-06-20T00:00:00.000Z" }, NOW);
  assertEqual(p.tier, "free");
  assertEqual(p.trial?.active, false);
  assertEqual(p.trial?.daysLeft, 0);
});
runner.test("never trialed -> free, trial null", () => {
  const p = resolvePlan(base, NOW);
  assertEqual(p.tier, "free"); assertEqual(p.trial, null);
});
runner.test("missing row -> free", () => {
  const p = resolvePlan(undefined, NOW);
  assertEqual(p.tier, "free"); assertEqual(p.founding, false);
});

runner.run();
