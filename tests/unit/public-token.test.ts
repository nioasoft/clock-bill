/** Unit tests for lib/public-token.ts */
import { generatePublicToken } from "../../lib/public-token";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running public-token tests...\n");
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

runner.test("token is 24 url-safe chars", () => {
  const t = generatePublicToken();
  assert(/^[A-Za-z0-9_-]{24}$/.test(t), `unexpected token shape: ${t}`);
});
runner.test("tokens are unique across many calls", () => {
  const set = new Set<string>();
  for (let i = 0; i < 1000; i++) set.add(generatePublicToken());
  assert(set.size === 1000, `expected 1000 unique, got ${set.size}`);
});

runner.run();
