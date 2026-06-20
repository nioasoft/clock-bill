/**
 * Unit tests for lib/document-language.ts
 * Verifies document language resolution based on client currency and explicit setting.
 */

import { resolveDocumentLocale } from "../../lib/document-language";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running document-language.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (error instanceof Error) {
          console.error(`     ${error.message}`);
        }
      }
    }
    console.log(
      `\n📊 Results: ${this.passed} passed, ${this.failed} failed`
    );
    return this.failed === 0;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}

const r = new TestRunner();

r.test("explicit he passes through regardless of currency", () => {
  assertEqual(resolveDocumentLocale("he", "USD"), "he");
});
r.test("explicit en passes through regardless of currency", () => {
  assertEqual(resolveDocumentLocale("en", "ILS"), "en");
});
r.test("auto + ILS resolves to he", () => {
  assertEqual(resolveDocumentLocale(null, "ILS"), "he");
});
r.test("auto + USD resolves to en", () => {
  assertEqual(resolveDocumentLocale(null, "USD"), "en");
});
r.test("auto + EUR/USDT/BTC/ETH resolve to en", () => {
  for (const c of ["EUR", "USDT", "BTC", "ETH"])
    assertEqual(resolveDocumentLocale(null, c), "en");
});
r.test(
  "auto + unknown/empty currency resolves to en (treated as foreign)",
  () => {
    assertEqual(resolveDocumentLocale(null, ""), "en");
  }
);

r.run().then((ok) => process.exit(ok ? 0 : 1));
