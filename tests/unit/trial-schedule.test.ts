import { pickDueEmail } from "../../lib/trial-emails-schedule";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running trial-schedule tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (a !== b) throw new Error(m ?? `Expected ${b}, got ${a}`); }
const runner = new TestRunner();
const none = new Set<string>();

runner.test("day 0-2: nothing due", () => assertEqual(pickDueEmail(2, none), null));
runner.test("day 3: d3 due", () => assertEqual(pickDueEmail(3, none), "trial_d3"));
runner.test("day 7: d7 due", () => assertEqual(pickDueEmail(7, none), "trial_d7"));
runner.test("day 11: d11 due", () => assertEqual(pickDueEmail(11, none), "trial_d11"));
runner.test("day 14: ended due", () => assertEqual(pickDueEmail(14, none), "trial_ended"));
runner.test("day 17: winback due", () => assertEqual(pickDueEmail(17, none), "trial_winback"));
runner.test("already-sent highest is skipped to next unsent reached", () => {
  // reached day 8, d3 already sent -> d7 due (highest reached, unsent)
  assertEqual(pickDueEmail(8, new Set(["trial_d3"])), "trial_d7");
});
runner.test("all reached already sent -> null", () => {
  assertEqual(pickDueEmail(7, new Set(["trial_d3", "trial_d7"])), null);
});
runner.test("missed days: highest reached unsent wins (no stale spam)", () => {
  // day 12, nothing sent -> d11 (highest reached), not d3
  assertEqual(pickDueEmail(12, none), "trial_d11");
});

runner.run();
