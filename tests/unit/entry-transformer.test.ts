/**
 * Unit tests for the shared entries transformer (lib/transformers/entries.ts).
 * Guards the field-drift bug: every entry endpoint maps through mapEntryRow, so
 * the response must always carry the full field set (incl. currency, pausedAt,
 * totalPausedTime) and apply the documented defaults.
 */
import { mapEntryRow, entrySelectColumns, type EntryRow } from "../../lib/transformers/entries";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }
  async run() {
    console.log("🧪 Running entry-transformer tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (e) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (e instanceof Error) console.error(`     ${e.message}`);
      }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const fullRow: EntryRow = {
  id: "e1",
  project_id: "p1",
  description: "כתיבת מכתב",
  start_time: "2026-06-01T08:00:00.000Z",
  end_time: "2026-06-01T09:00:00.000Z",
  duration: 60,
  date: "2026-06-01",
  tags: ["a", "b"],
  notes: "הערה",
  is_billable: true,
  created_at: "2026-06-01T08:00:00.000Z",
  paused_at: "2026-06-01T08:30:00.000Z",
  total_paused_time: 120,
  task_id: "t1",
  billing_kind: "hourly",
  rate: 350,
  rate_label: "שעתי",
  quantity: null,
  item_ref: null,
  unit: null,
  discount_percent: null,
  charge_document_id: null,
  written_off_at: null,
  project_name: "אתר",
  client_name: "לקוח",
  client_id: "c1",
  currency: "USD",
  task_name: "משימה",
  charge_doc_number: null,
  charge_doc_status: null,
};

const runner = new TestRunner();

// ── field completeness (the drift guard) ────────────────────────────────────
const REQUIRED_KEYS = [
  "id", "projectId", "projectName", "clientId", "clientName", "currency",
  "description", "startTime", "endTime", "duration", "date", "tags", "notes",
  "isBillable", "createdAt", "pausedAt", "totalPausedTime", "taskId", "taskName",
  "billingKind", "rate", "rateLabel", "quantity", "itemRef", "unit",
  "discountPercent", "chargeDocumentId", "chargeDocNumber", "chargeDocStatus", "writtenOffAt",
] as const;

runner.test("mapEntryRow returns the full field set", () => {
  const out = mapEntryRow(fullRow);
  for (const k of REQUIRED_KEYS) {
    assert(k in out, `missing field "${k}" in mapped entry`);
  }
});

runner.test("mapEntryRow maps snake_case → camelCase values", () => {
  const out = mapEntryRow(fullRow);
  assert(out.projectId === "p1", "projectId");
  assert(out.clientId === "c1", "clientId");
  assert(out.currency === "USD", "currency");
  assert(out.pausedAt === "2026-06-01T08:30:00.000Z", "pausedAt");
  assert(out.totalPausedTime === 120, "totalPausedTime");
  assert(out.rateLabel === "שעתי", "rateLabel");
  assert(out.taskName === "משימה", "taskName");
});

// ── defaults ────────────────────────────────────────────────────────────────
runner.test("currency defaults to ILS when null", () => {
  const out = mapEntryRow({ ...fullRow, currency: null });
  assert(out.currency === "ILS", `expected ILS, got "${out.currency}"`);
});
runner.test("billingKind defaults to hourly when null", () => {
  const out = mapEntryRow({ ...fullRow, billing_kind: null });
  assert(out.billingKind === "hourly", `expected hourly, got "${out.billingKind}"`);
});
runner.test("tags defaults to [] when null", () => {
  const out = mapEntryRow({ ...fullRow, tags: null });
  assert(Array.isArray(out.tags) && (out.tags as unknown[]).length === 0, "tags should be []");
});
runner.test("paused fields pass through null", () => {
  const out = mapEntryRow({ ...fullRow, paused_at: null, total_paused_time: null });
  assert(out.pausedAt === null, "pausedAt null");
  assert(out.totalPausedTime === null, "totalPausedTime null");
});

// ── billed status (charge-document lock) ─────────────────────────────────────
runner.test("unbilled entry maps charge-document fields to null", () => {
  const out = mapEntryRow(fullRow);
  assert(out.chargeDocumentId === null, "chargeDocumentId null");
  assert(out.chargeDocNumber === null, "chargeDocNumber null");
  assert(out.chargeDocStatus === null, "chargeDocStatus null");
});
runner.test("billed entry passes through charge-document fields", () => {
  const out = mapEntryRow({
    ...fullRow,
    charge_document_id: "doc1",
    charge_doc_number: 42,
    charge_doc_status: "pending",
  });
  assert(out.chargeDocumentId === "doc1", "chargeDocumentId");
  assert(out.chargeDocNumber === 42, "chargeDocNumber");
  assert(out.chargeDocStatus === "pending", "chargeDocStatus");
});
runner.test("entrySelectColumns selects the billed-status columns", () => {
  const cols = entrySelectColumns("te");
  assert(cols.includes("te.charge_document_id"), "charge_document_id column");
  assert(cols.includes("cd.doc_number as charge_doc_number"), "charge_doc_number column");
  assert(cols.includes("cd.status as charge_doc_status"), "charge_doc_status column");
  assert(cols.includes("te.written_off_at"), "written_off_at column");
});

// ── write-off marker ─────────────────────────────────────────────────────────
runner.test("written-off entry passes writtenOffAt through", () => {
  const out = mapEntryRow({ ...fullRow, written_off_at: "2026-07-12T10:00:00.000Z" });
  assert(out.writtenOffAt === "2026-07-12T10:00:00.000Z", "writtenOffAt value");
});
runner.test("normal entry maps writtenOffAt to null", () => {
  const out = mapEntryRow(fullRow);
  assert(out.writtenOffAt === null, "writtenOffAt null");
});

// ── column list ─────────────────────────────────────────────────────────────
runner.test("entrySelectColumns includes the previously-drifted columns", () => {
  const cols = entrySelectColumns("te");
  assert(cols.includes("te.paused_at"), "paused_at column");
  assert(cols.includes("te.total_paused_time"), "total_paused_time column");
  assert(cols.includes("c.currency as currency"), "currency column");
});
runner.test("entrySelectColumns respects the time_entries alias", () => {
  const cols = entrySelectColumns("ins");
  assert(cols.includes("ins.id"), "should prefix te columns with the given alias");
  assert(cols.includes("p.name as project_name"), "join aliases stay fixed");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
