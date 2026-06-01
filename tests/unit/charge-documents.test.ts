/**
 * Unit tests for lib/charge-documents.ts — pure settlement logic.
 */
import {
  canTransition,
  computeDocumentTotal,
  buildLineFromEntry,
  type BillableEntry,
} from "../../lib/charge-documents";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running charge-documents tests...\n");
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

runner.test("pending -> paid allowed", () => { assertEqual(canTransition("pending", "paid"), true); });
runner.test("pending -> canceled allowed", () => { assertEqual(canTransition("pending", "canceled"), true); });
runner.test("paid -> pending allowed (unpay)", () => { assertEqual(canTransition("paid", "pending"), true); });
runner.test("paid -> canceled NOT allowed (must unpay first)", () => { assertEqual(canTransition("paid", "canceled"), false); });
runner.test("canceled -> anything NOT allowed", () => {
  assertEqual(canTransition("canceled", "pending"), false);
  assertEqual(canTransition("canceled", "paid"), false);
});

runner.test("computeDocumentTotal sums line amounts exactly", () => {
  assertEqual(computeDocumentTotal([{ amount: 300 }, { amount: 99.99 }, { amount: 0.01 }]), 400);
});
runner.test("computeDocumentTotal handles null amounts as 0", () => {
  assertEqual(computeDocumentTotal([{ amount: null }, { amount: 50 }]), 50);
});

runner.test("buildLineFromEntry: hourly entry -> hourly line amount", () => {
  const entry: BillableEntry = {
    id: "e1", description: "פיתוח", notes: "מסך לוגין", billingKind: "hourly",
    duration: 90, quantity: null, rate: 200, rateLabel: "תכנות", itemRef: null,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.sourceType, "time_entry");
  assertEqual(line.timeEntryId, "e1");
  assertEqual(line.billingKind, "hourly");
  assertEqual(line.amount, 300);
  assertEqual(line.label, "תכנות");
  assertEqual(line.description, "פיתוח");
  assertEqual(line.notes, "מסך לוגין");
});
runner.test("buildLineFromEntry: item entry -> item line amount + item_ref", () => {
  const entry: BillableEntry = {
    id: "e2", description: "מכתב", notes: "בנושא שכירות", billingKind: "item",
    duration: 0, quantity: 3, rate: 100, rateLabel: "כתיבת מכתב", itemRef: 42,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.billingKind, "item");
  assertEqual(line.amount, 300);
  assertEqual(line.itemRef, 42);
  assertEqual(line.quantity, 3);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
