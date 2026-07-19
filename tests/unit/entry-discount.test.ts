/**
 * Unit tests for the per-entry discount: applyPercentDiscount (lib/money) and
 * its application in buildLineFromEntry (lib/charge-documents).
 */
import { applyPercentDiscount } from "../../lib/money";
import { buildLineFromEntry, computeDocumentTotal, type BillableEntry } from "../../lib/charge-documents";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running entry-discount tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) throw new Error(message || `Expected "${expected}" but got "${actual}"`);
}

const runner = new TestRunner();

runner.test("null/undefined/0 percent is a no-op (rounded)", () => {
  assertEqual(applyPercentDiscount(100, null), 100);
  assertEqual(applyPercentDiscount(100, undefined), 100);
  assertEqual(applyPercentDiscount(100, 0), 100);
});

runner.test("10% off 187.5 rounds to whole cents", () => {
  assertEqual(applyPercentDiscount(187.5, 10), 168.75);
});

runner.test("100% discount zeroes the amount", () => {
  assertEqual(applyPercentDiscount(250, 100), 0);
});

runner.test("percent above 100 clamps to 100", () => {
  assertEqual(applyPercentDiscount(250, 150), 0);
});

runner.test("cents rounding: 33.3% off 100 -> 66.70", () => {
  assertEqual(applyPercentDiscount(100, 33.3), 66.7);
});

runner.test("hourly line: discount nets the amount, keeps rate and snapshots percent", () => {
  const entry: BillableEntry = {
    id: "e1", description: "שיחת זום", notes: null, billingKind: "hourly",
    duration: 45, quantity: null, rate: 250, rateLabel: "עבודה פקידותית",
    itemRef: null, discountPercent: 10,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.amount, 168.75); // (45/60)×250 = 187.5, minus 10%
  assertEqual(line.rate, 250); // original rate stays for the qty×rate column
  assertEqual(line.discountPercent, 10);
});

runner.test("hourly line: rounding applies BEFORE the discount", () => {
  const entry: BillableEntry = {
    id: "e2", description: "x", notes: null, billingKind: "hourly",
    duration: 50, quantity: null, rate: 300, rateLabel: null, itemRef: null,
    billingRounding: "hour_up", discountPercent: 50,
  };
  // 50min → 60min billed → 300, then 50% off.
  assertEqual(buildLineFromEntry(entry).amount, 150);
});

runner.test("item line: discount nets quantity × rate", () => {
  const entry: BillableEntry = {
    id: "e3", description: "מכתב", notes: null, billingKind: "item",
    duration: 0, quantity: 3, rate: 100, rateLabel: "מכתב", itemRef: 7,
    unit: "מסמך", discountPercent: 25,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.amount, 225);
  assertEqual(line.discountPercent, 25);
});

runner.test("no discount -> discountPercent null on the line, amount unchanged", () => {
  const entry: BillableEntry = {
    id: "e4", description: "x", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 200, rateLabel: null, itemRef: null,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.amount, 200);
  assertEqual(line.discountPercent, null);
});

runner.test("document total sums NET line amounts", () => {
  const lines = [
    buildLineFromEntry({ id: "a", description: "x", notes: null, billingKind: "hourly", duration: 45, quantity: null, rate: 250, rateLabel: null, itemRef: null, discountPercent: 10 }),
    buildLineFromEntry({ id: "b", description: "y", notes: null, billingKind: "hourly", duration: 120, quantity: null, rate: 250, rateLabel: null, itemRef: null }),
  ];
  assertEqual(computeDocumentTotal(lines), 668.75); // 168.75 + 500
});

runner.run().then((ok) => { if (!ok) process.exit(1); });
