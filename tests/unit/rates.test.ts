/**
 * Unit tests for lib/money.ts calcItemAmount and rate-list helpers.
 */
import { calcItemAmount, sumMoney } from "../../lib/money";
import { pickDefaultHourlyRate, type ClientRate } from "../../lib/schemas/rates";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }
  async run() {
    console.log("🧪 Running rates tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (e) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (e instanceof Error) console.error(`     ${e.message}`);
      }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message || `Expected "${expected}" but got "${actual}"`);
}

const runner = new TestRunner();

runner.test("calcItemAmount: 3 units @ 100 = 300", () => {
  assertEqual(calcItemAmount(3, 100), 300);
});
runner.test("calcItemAmount: fractional units round to cents", () => {
  assertEqual(calcItemAmount(3, 33.333), 100); // 99.999 -> 100.00
  assertEqual(calcItemAmount(1.5, 100), 150);
});
runner.test("calcItemAmount: null/zero is 0", () => {
  assertEqual(calcItemAmount(null, 100), 0);
  assertEqual(calcItemAmount(3, null), 0);
  assertEqual(calcItemAmount(0, 100), 0);
});
runner.test("calcItemAmount: summing item lines stays exact", () => {
  assertEqual(sumMoney([calcItemAmount(3, 100), calcItemAmount(2, 50)]), 400);
});

const hourly = (name: string, rate: number, isDefault: boolean): ClientRate =>
  ({ id: name, kind: "hourly", name, rate, isDefault });

runner.test("pickDefaultHourlyRate: returns the default hourly row", () => {
  const rates = [hourly("הדרכה", 200, false), hourly("תכנות", 300, true)];
  assertEqual(pickDefaultHourlyRate(rates)?.name, "תכנות");
});
runner.test("pickDefaultHourlyRate: falls back to first hourly when none default", () => {
  const rates: ClientRate[] = [
    { id: "i", kind: "item", name: "מכתב", rate: 100, isDefault: false },
    hourly("הדרכה", 200, false),
  ];
  assertEqual(pickDefaultHourlyRate(rates)?.name, "הדרכה");
});
runner.test("pickDefaultHourlyRate: null when no hourly rates", () => {
  assertEqual(pickDefaultHourlyRate([]), null);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
