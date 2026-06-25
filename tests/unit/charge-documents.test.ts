/**
 * Unit tests for lib/charge-documents.ts — pure settlement logic.
 */
import {
  canTransition,
  computeDocumentTotal,
  buildLineFromEntry,
  lineQtyRate,
  summarizeLines,
  type BillableEntry,
  type SummaryLine,
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
runner.test("buildLineFromEntry: snapshots the entry date (null when absent)", () => {
  const dated: BillableEntry = {
    id: "e4", date: "2026-06-25", description: "פיתוח", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 100, rateLabel: "תכנות", itemRef: null,
  };
  assertEqual(buildLineFromEntry(dated).date, "2026-06-25");
  const undated: BillableEntry = {
    id: "e5", description: "פיתוח", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 100, rateLabel: "תכנות", itemRef: null,
  };
  assertEqual(buildLineFromEntry(undated).date, null);
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
runner.test("buildLineFromEntry: null rateLabel falls back to description for label", () => {
  const entry: BillableEntry = {
    id: "e3", description: "ייעוץ", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 150, rateLabel: null, itemRef: null,
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.label, "ייעוץ");
  assertEqual(line.notes, null);
});

runner.test("computeDocumentTotal of empty list is 0", () => {
  assertEqual(computeDocumentTotal([]), 0);
});

runner.test("buildLineFromEntry: item entry carries unit into the draft (amount unchanged)", () => {
  const entry: BillableEntry = {
    id: "e10", description: "טיפול", notes: null, billingKind: "item",
    duration: 0, quantity: 3, rate: 400, rateLabel: "פגישה", itemRef: 7, unit: "פגישה",
  };
  const line = buildLineFromEntry(entry);
  assertEqual(line.unit, "פגישה");
  assertEqual(line.amount, 1200);
});
runner.test("buildLineFromEntry: hourly entry gets null unit", () => {
  const entry: BillableEntry = {
    id: "e11", description: "ייעוץ", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 150, rateLabel: "ייעוץ", itemRef: null, unit: "פגישה",
  };
  assertEqual(buildLineFromEntry(entry).unit, null);
});
runner.test("buildLineFromEntry: hourly entry stores billed hours in quantity", () => {
  const entry: BillableEntry = {
    id: "e13", description: "תכנות", notes: null, billingKind: "hourly",
    duration: 90, quantity: null, rate: 200, rateLabel: "תכנות", itemRef: null,
  };
  // 90 min, no rounding → 1.5 billed hours.
  assertEqual(buildLineFromEntry(entry).quantity, 1.5);
});
runner.test("buildLineFromEntry: hourly quantity reflects rounding (40min→quarter_hour_up=0.75h)", () => {
  const entry: BillableEntry = {
    id: "e14", description: "ייעוץ", notes: null, billingKind: "hourly",
    duration: 40, quantity: null, rate: 100, rateLabel: "ייעוץ", itemRef: null,
    billingRounding: "quarter_hour_up",
  };
  // 40 min rounds up to 45 → 0.75 h.
  assertEqual(buildLineFromEntry(entry).quantity, 0.75);
});
runner.test("buildLineFromEntry: carries projectName into the draft", () => {
  const entry: BillableEntry = {
    id: "e15", description: "תכנות", notes: null, billingKind: "hourly",
    duration: 60, quantity: null, rate: 100, rateLabel: "תכנות", itemRef: null,
    projectName: "אתר תדמית",
  };
  assertEqual(buildLineFromEntry(entry).projectName, "אתר תדמית");
});
runner.test("buildLineFromEntry: item without unit -> null unit", () => {
  const entry: BillableEntry = {
    id: "e12", description: "מכתב", notes: null, billingKind: "item",
    duration: 0, quantity: 2, rate: 100, rateLabel: "מכתב", itemRef: 8,
  };
  assertEqual(buildLineFromEntry(entry).unit, null);
});

// ── lineQtyRate ─────────────────────────────────────────────────────────────
runner.test("lineQtyRate: hourly with stored hours → hours + rate", () => {
  const qr = lineQtyRate({ billing_kind: "hourly", quantity: 1.5, unit: null, rate: 200, amount: 300 });
  assertEqual(qr?.isHourly, true);
  assertEqual(qr?.qty, 1.5);
  assertEqual(qr?.rate, 200);
});
runner.test("lineQtyRate: legacy hourly (quantity null) derives hours from amount/rate", () => {
  const qr = lineQtyRate({ billing_kind: "hourly", quantity: null, unit: null, rate: 80, amount: 40 });
  assertEqual(qr?.isHourly, true);
  assertEqual(qr?.qty, 0.5);
});
runner.test("lineQtyRate: item → qty + unit + rate", () => {
  const qr = lineQtyRate({ billing_kind: "item", quantity: 3, unit: "פגישה", rate: 100, amount: 300 });
  assertEqual(qr?.isHourly, false);
  assertEqual(qr?.qty, 3);
  assertEqual(qr?.unit, "פגישה");
});
runner.test("lineQtyRate: fixed line → null", () => {
  assertEqual(lineQtyRate({ billing_kind: "fixed", quantity: null, unit: null, rate: null, amount: 500 }), null);
});
runner.test("lineQtyRate: no rate → null", () => {
  assertEqual(lineQtyRate({ billing_kind: "hourly", quantity: 2, unit: null, rate: 0, amount: 0 }), null);
});

// ── summarizeLines ──────────────────────────────────────────────────────────
const sLines: SummaryLine[] = [
  { billing_kind: "hourly", label: "תכנות", project_name: "אתר", quantity: 2, unit: null, rate: 100, amount: 200 },
  { billing_kind: "hourly", label: "תכנות", project_name: "אפליקציה", quantity: 1, unit: null, rate: 100, amount: 100 },
  { billing_kind: "item", label: "עיצוב", project_name: "אתר", quantity: 1, unit: "פגישה", rate: 300, amount: 300 },
  { billing_kind: "fixed", label: "ריטיינר", project_name: null, quantity: null, unit: null, rate: null, amount: 500 },
];

runner.test("summarizeLines by type: groups by label, sums hours + amount", () => {
  const g = summarizeLines(sLines, "type");
  assertEqual(g.length, 3); // תכנות, עיצוב, ריטיינר
  const prog = g.find((x) => x.key === "תכנות")!;
  assertEqual(prog.hours, 3);
  assertEqual(prog.amount, 300);
  const design = g.find((x) => x.key === "עיצוב")!;
  assertEqual(design.hours, 0); // item line contributes amount only
  assertEqual(design.amount, 300);
});
runner.test("summarizeLines by project: groups by project_name, null = its own bucket", () => {
  const g = summarizeLines(sLines, "project");
  assertEqual(g.length, 3); // אתר, אפליקציה, null
  const site = g.find((x) => x.key === "אתר")!;
  assertEqual(site.hours, 2);
  assertEqual(site.amount, 500); // 200 hourly + 300 item
  const none = g.find((x) => x.key === null)!;
  assertEqual(none.amount, 500); // the fixed retainer line
});
runner.test("summarizeLines preserves first-appearance order", () => {
  const g = summarizeLines(sLines, "type");
  assertEqual(g[0].key, "תכנות");
  assertEqual(g[1].key, "עיצוב");
  assertEqual(g[2].key, "ריטיינר");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
