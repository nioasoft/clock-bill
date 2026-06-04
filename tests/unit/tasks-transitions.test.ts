/** Unit tests for lib/tasks-transitions.ts — the per-status action buttons. */
import { allowedTransitions } from "../../lib/tasks-transitions";
import { TASK_STATUSES } from "../../lib/tasks-types";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-transitions.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(a: T, b: T, m?: string) { if (a !== b) throw new Error(m || `Expected "${b}" but got "${a}"`); }
const runner = new TestRunner();

runner.test("todo offers exactly 2 transitions, primary is in_progress", () => {
  const t = allowedTransitions("todo");
  assertEqual(t.length, 2);
  assertEqual(t[0].to, "in_progress");
  assertEqual(t[0].primary, true);
  assertEqual(t[0].label, "התחל");
  assertEqual(t[1].to, "done");
});
runner.test("in_progress offers done (primary) + todo", () => {
  const t = allowedTransitions("in_progress");
  assertEqual(t.length, 2);
  assertEqual(t[0].to, "done");
  assertEqual(t[0].primary, true);
  assertEqual(t[0].label, "סיים");
  assertEqual(t[1].to, "todo");
});
runner.test("done offers in_progress (primary) + todo", () => {
  const t = allowedTransitions("done");
  assertEqual(t.length, 2);
  assertEqual(t[0].to, "in_progress");
  assertEqual(t[0].primary, true);
  assertEqual(t[1].to, "todo");
});
runner.test("no transition targets its own status", () => {
  for (const s of TASK_STATUSES) {
    for (const tr of allowedTransitions(s)) {
      if (tr.to === s) throw new Error(`status ${s} has a self-transition`);
    }
  }
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
