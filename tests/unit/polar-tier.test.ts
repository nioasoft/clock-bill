/** Unit tests for the pure product-id → tier mapping in lib/polar.ts. */
import { tierForProductId, polarEnabled } from "../../lib/polar";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(n: string, f: () => void) { this.tests.push({ name: n, fn: f }); }
  async run() {
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log("✅", name); }
      catch (e) { this.failed++; console.log("❌", name); console.error(e); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}
function assertEqual(a: unknown, b: unknown) { if (a !== b) throw new Error(`Expected ${b}, got ${a}`); }

const map = { "p_sm": "starter", "p_sa": "starter", "p_um": "unlimited", "p_ua": "unlimited" } as const;
const r = new TestRunner();
r.test("starter monthly id → starter", () => assertEqual(tierForProductId("p_sm", map), "starter"));
r.test("unlimited annual id → unlimited", () => assertEqual(tierForProductId("p_ua", map), "unlimited"));
r.test("unknown id → null", () => assertEqual(tierForProductId("nope", map), null));
r.test("null id → null", () => assertEqual(tierForProductId(null, map), null));
r.test("polarEnabled is a boolean", () => assertEqual(typeof polarEnabled, "boolean"));
r.run();
