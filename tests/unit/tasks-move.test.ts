/** Unit tests for lib/tasks-move.ts — the drag→timer effect decision. */
import { moveEffect } from "../../lib/tasks-move";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-move.ts tests...\n");
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

runner.test("todo → in_progress: start a timer", () => {
  assertEqual(moveEffect({ from: "todo", to: "in_progress", hasRunningTimer: false }), "start_timer");
});
runner.test("done → in_progress: start a timer", () => {
  assertEqual(moveEffect({ from: "done", to: "in_progress", hasRunningTimer: false }), "start_timer");
});
runner.test("in_progress → in_progress (reorder): plain, no second timer", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "in_progress", hasRunningTimer: true }), "plain");
});
runner.test("in_progress → done WITH running timer: open stop modal", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "done", hasRunningTimer: true }), "open_stop_modal");
});
runner.test("in_progress → todo WITH running timer: open stop modal", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "todo", hasRunningTimer: true }), "open_stop_modal");
});
runner.test("in_progress → done WITHOUT running timer: plain", () => {
  assertEqual(moveEffect({ from: "in_progress", to: "done", hasRunningTimer: false }), "plain");
});
runner.test("todo → done (no in_progress involved): plain", () => {
  assertEqual(moveEffect({ from: "todo", to: "done", hasRunningTimer: false }), "plain");
});
runner.test("todo → todo (reorder): plain", () => {
  assertEqual(moveEffect({ from: "todo", to: "todo", hasRunningTimer: false }), "plain");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
