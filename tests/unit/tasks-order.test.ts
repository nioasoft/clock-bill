/** Unit tests for lib/tasks-order.ts — fractional position math for drag & drop. */
import { positionBetween, INITIAL_POSITION, POSITION_GAP } from "../../lib/tasks-order";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-order.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(actual: T, expected: T, msg?: string) {
  if (actual !== expected) throw new Error(msg || `Expected "${expected}" but got "${actual}"`);
}
function assertTrue(cond: boolean, msg?: string) { if (!cond) throw new Error(msg || "expected true"); }

const runner = new TestRunner();

runner.test("empty column: first item gets INITIAL_POSITION", () => {
  assertEqual(positionBetween(null, null), INITIAL_POSITION);
});
runner.test("drop at top: above the first item", () => {
  assertEqual(positionBetween(null, 1000), 1000 - POSITION_GAP);
});
runner.test("drop at bottom: below the last item", () => {
  assertEqual(positionBetween(1000, null), 1000 + POSITION_GAP);
});
runner.test("drop between two items: midpoint", () => {
  assertEqual(positionBetween(1000, 2000), 1500);
});
runner.test("midpoint stays strictly between neighbors", () => {
  const p = positionBetween(1000, 1001);
  assertTrue(p > 1000 && p < 1001, `expected 1000 < ${p} < 1001`);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
