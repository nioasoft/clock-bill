/** Unit tests for lib/public-token.ts */
import {
  generatePublicToken,
  isValidPublicToken,
  publicLinkExpiry,
  PUBLIC_LINK_TTL_DAYS,
} from "../../lib/public-token";

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
runner.test("only canonical public-token shapes are accepted", () => {
  assert(isValidPublicToken(generatePublicToken()), "generated token was rejected");
  assert(!isValidPublicToken("short"), "short token was accepted");
  assert(!isValidPublicToken("A".repeat(23) + "."), "non-url-safe token was accepted");
  assert(!isValidPublicToken("A".repeat(25)), "oversized token was accepted");
});
runner.test("public links expire exactly 30 days after issuance", () => {
  const now = new Date("2026-07-10T12:00:00.000Z");
  const expiresAt = publicLinkExpiry(now);
  const expectedMs = now.getTime() + 30 * 24 * 60 * 60 * 1000;

  assert(PUBLIC_LINK_TTL_DAYS === 30, `unexpected TTL: ${PUBLIC_LINK_TTL_DAYS}`);
  assert(expiresAt.getTime() === expectedMs, `unexpected expiry: ${expiresAt.toISOString()}`);
  assert(now.toISOString() === "2026-07-10T12:00:00.000Z", "input date was mutated");
});

runner.run();
