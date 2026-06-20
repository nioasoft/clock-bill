/**
 * Unit tests for lib/vat.ts
 * Verifies VAT rate resolution (inherit / add / exempt) and the money-safe
 * subtotal / VAT / total breakdown.
 */

import {
  resolveVatRate,
  computeVatBreakdown,
  DEFAULT_VAT_RATE,
} from "../../lib/vat";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running vat.ts tests...\n");
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
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}

const r = new TestRunner();

// ── resolveVatRate ──────────────────────────────────────────────────────────
r.test("exempt → null regardless of global registration", () => {
  assertEqual(resolveVatRate("exempt", true, 18), null);
  assertEqual(resolveVatRate("exempt", false, null), null);
});
r.test("add → profile rate when set", () => {
  assertEqual(resolveVatRate("add", true, 17), 17);
});
r.test("add → DEFAULT_VAT_RATE when profile rate null", () => {
  assertEqual(resolveVatRate("add", false, null), DEFAULT_VAT_RATE);
});
r.test("inherit + registered → profile rate", () => {
  assertEqual(resolveVatRate(null, true, 18), 18);
});
r.test("inherit + registered + null rate → DEFAULT_VAT_RATE", () => {
  assertEqual(resolveVatRate(null, true, null), DEFAULT_VAT_RATE);
});
r.test("inherit + NOT registered → null (no VAT)", () => {
  assertEqual(resolveVatRate(null, false, 18), null);
});

// ── computeVatBreakdown ─────────────────────────────────────────────────────
r.test("null rate → no VAT, total === subtotal", () => {
  const b = computeVatBreakdown(100, null);
  assertEqual(b.subtotal, 100);
  assertEqual(b.vatAmount, 0);
  assertEqual(b.total, 100);
});
r.test("zero rate → no VAT", () => {
  const b = computeVatBreakdown(100, 0);
  assertEqual(b.vatAmount, 0);
  assertEqual(b.total, 100);
});
r.test("18% of 100 → 18, total 118", () => {
  const b = computeVatBreakdown(100, 18);
  assertEqual(b.vatAmount, 18);
  assertEqual(b.total, 118);
});
r.test("money-safe rounding: 18% of 40.10 → 7.22, total 47.32", () => {
  const b = computeVatBreakdown(40.1, 18);
  assertEqual(b.vatAmount, 7.22);
  assertEqual(b.total, 47.32);
});
r.test("subtotal is snapped to whole cents", () => {
  const b = computeVatBreakdown(0.1 + 0.2, 18); // 0.30000000000000004
  assertEqual(b.subtotal, 0.3);
});

r.run().then((ok) => process.exit(ok ? 0 : 1));
