import { isPlanLockedSentinel } from "../../lib/plan-guard";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running plan-guard-routes tests...\n");
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

runner.test("recognizes the planLocked sentinel", () => {
  assertEqual(isPlanLockedSentinel({ planLocked: true }), true);
});
runner.test("ignores other objects", () => {
  assertEqual(isPlanLockedSentinel({ notFound: true }), false);
  assertEqual(isPlanLockedSentinel(null), false);
  assertEqual(isPlanLockedSentinel({ id: "x" }), false);
});

runner.run();
