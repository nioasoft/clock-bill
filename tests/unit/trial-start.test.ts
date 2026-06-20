/** Unit tests for buildTrialStart. */
import { buildTrialStart } from "../../lib/trial";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-start tests...\n");
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

runner.test("buildTrialStart: endsAt is 14 days after startedAt", () => {
  const now = new Date("2026-06-19T08:00:00.000Z");
  const { startedAt, endsAt } = buildTrialStart(now);
  assertEqual(startedAt.toISOString(), "2026-06-19T08:00:00.000Z");
  assertEqual(endsAt.toISOString(), "2026-07-03T08:00:00.000Z");
});

runner.run();
