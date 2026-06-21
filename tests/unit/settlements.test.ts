/** Unit tests for lib/settlements.ts (settlement-day math). */
import {
  daysInMonth,
  effectiveBillingDay,
  hasReachedBillingDay,
  isBillingDayToday,
} from "../../lib/settlements";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running settlements tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
function assert(cond: boolean, message: string) { if (!cond) throw new Error(message); }
const runner = new TestRunner();

runner.test("daysInMonth: Feb 2026 = 28, Feb 2028 (leap) = 29", () => {
  assert(daysInMonth(2026, 2) === 28, "Feb 2026");
  assert(daysInMonth(2028, 2) === 29, "Feb 2028 leap");
  assert(daysInMonth(2026, 1) === 31, "Jan");
  assert(daysInMonth(2026, 4) === 30, "Apr");
});
runner.test("effectiveBillingDay clamps to month length", () => {
  assert(effectiveBillingDay(31, 2026, 2) === 28, "31 in Feb -> 28");
  assert(effectiveBillingDay(31, 2028, 2) === 29, "31 in leap Feb -> 29");
  assert(effectiveBillingDay(15, 2026, 6) === 15, "mid-month unchanged");
  assert(effectiveBillingDay(31, 2026, 1) === 31, "31 in Jan -> 31");
});
runner.test("hasReachedBillingDay: true on/after effective day", () => {
  assert(hasReachedBillingDay(1, 1, 2026, 6) === true, "day 1, billing 1");
  assert(hasReachedBillingDay(14, 15, 2026, 6) === false, "before billing day");
  assert(hasReachedBillingDay(28, 31, 2026, 2) === true, "Feb 28 reaches clamped 31");
});
runner.test("isBillingDayToday: exact effective-day match", () => {
  assert(isBillingDayToday(15, 15, 2026, 6) === true, "exact");
  assert(isBillingDayToday(16, 15, 2026, 6) === false, "day after");
  assert(isBillingDayToday(28, 31, 2026, 2) === true, "Feb 28 == clamped 31");
});

runner.run();
