/**
 * Unit tests for lib/plans.ts — tier caps and add-client gating (pure logic).
 */
import {
  PLAN_TIERS,
  getClientLimit,
  canAddClient,
  isPlanTier,
} from "../../lib/plans";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running plans.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`✅ ${name}`); }
      catch (e) { this.failed++; console.log(`❌ ${name}`); console.error(e); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}
function assertEqual(a: unknown, b: unknown, msg?: string) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

const r = new TestRunner();

r.test("tiers are free/starter/unlimited", () => {
  assertEqual(PLAN_TIERS.join(","), "free,starter,unlimited");
});
r.test("free cap is 1", () => assertEqual(getClientLimit("free"), 1));
r.test("starter cap is 5", () => assertEqual(getClientLimit("starter"), 5));
r.test("unlimited cap is Infinity", () => assertEqual(getClientLimit("unlimited"), Infinity));
r.test("free: 0 active can add", () => assertEqual(canAddClient("free", 0), true));
r.test("free: 1 active cannot add", () => assertEqual(canAddClient("free", 1), false));
r.test("starter: 4 active can add", () => assertEqual(canAddClient("starter", 4), true));
r.test("starter: 5 active cannot add", () => assertEqual(canAddClient("starter", 5), false));
r.test("unlimited: 9999 active can add", () => assertEqual(canAddClient("unlimited", 9999), true));
r.test("isPlanTier accepts valid", () => assertEqual(isPlanTier("starter"), true));
r.test("isPlanTier rejects junk", () => assertEqual(isPlanTier("gold"), false));

r.run();
