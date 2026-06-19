/** Unit tests for trial-math helpers in lib/plans.ts */
import { TRIAL_DAYS, computeTrialEnd, isTrialActive, trialDaysLeft } from "../../lib/plans";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-plans tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message ?? `Expected ${expected}, got ${actual}`);
}
const runner = new TestRunner();

runner.test("TRIAL_DAYS is 14", () => assertEqual(TRIAL_DAYS, 14));

runner.test("computeTrialEnd adds 14 days", () => {
  const start = new Date("2026-06-19T00:00:00.000Z");
  assertEqual(computeTrialEnd(start).toISOString(), "2026-07-03T00:00:00.000Z");
});

runner.test("isTrialActive: future end is active", () => {
  assertEqual(isTrialActive(new Date("2026-07-03T00:00:00Z"), new Date("2026-06-25T00:00:00Z")), true);
});
runner.test("isTrialActive: past end is inactive", () => {
  assertEqual(isTrialActive(new Date("2026-06-19T00:00:00Z"), new Date("2026-06-25T00:00:00Z")), false);
});
runner.test("isTrialActive: null end is inactive", () => {
  assertEqual(isTrialActive(null, new Date("2026-06-25T00:00:00Z")), false);
});

runner.test("trialDaysLeft: ceils partial days", () => {
  // 3.5 days left -> 4
  const now = new Date("2026-06-19T12:00:00Z");
  const end = new Date("2026-06-23T00:00:00Z");
  assertEqual(trialDaysLeft(end, now), 4);
});
runner.test("trialDaysLeft: never negative", () => {
  assertEqual(trialDaysLeft(new Date("2026-06-19T00:00:00Z"), new Date("2026-06-25T00:00:00Z")), 0);
});

runner.run();
