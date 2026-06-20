/** Unit tests for computeLockedClientIds (pure lock-ranking). */
import { computeLockedClientIds } from "../../lib/plan-guard";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running locked-clients tests...\n");
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

// ranked = client ids already ordered by rank DESC (most-active first)
runner.test("free (limit 1): all but the first are locked", () => {
  assertEqual(computeLockedClientIds(["a", "b", "c"], 1), ["b", "c"]);
});
runner.test("starter (limit 5): tail beyond 5 locked", () => {
  assertEqual(computeLockedClientIds(["a","b","c","d","e","f","g"], 5), ["f", "g"]);
});
runner.test("under limit: none locked", () => {
  assertEqual(computeLockedClientIds(["a"], 1), []);
});
runner.test("unlimited (Infinity): none locked", () => {
  assertEqual(computeLockedClientIds(["a","b","c"], Infinity), []);
});
runner.test("empty list: none locked", () => {
  assertEqual(computeLockedClientIds([], 1), []);
});

runner.run();
