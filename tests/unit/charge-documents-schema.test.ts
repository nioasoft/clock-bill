/**
 * Unit tests for lib/schemas/charge-documents.ts
 */
import {
  createChargeDocumentSchema,
  patchChargeLineSchema,
  patchChargeDocumentSchema,
} from "../../lib/schemas/charge-documents";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running charge-documents-schema tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assert(cond: boolean, message: string) { if (!cond) throw new Error(message); }

const runner = new TestRunner();

runner.test("create: valid payload parses", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1", pdfTemplate: "modern", notes: "יוני", timeEntryIds: ["e1", "e2"], computedLines: [],
  });
  assert(r.success, "expected valid payload to parse");
});
runner.test("create: rejects empty clientId", () => {
  const r = createChargeDocumentSchema.safeParse({ clientId: "", pdfTemplate: "modern", timeEntryIds: ["e1"], computedLines: [] });
  assert(!r.success, "expected empty clientId to fail");
});
runner.test("create: rejects when no lines selected at all", () => {
  const r = createChargeDocumentSchema.safeParse({ clientId: "c1", pdfTemplate: "modern", timeEntryIds: [], computedLines: [] });
  assert(!r.success, "expected zero-line document to fail");
});
runner.test("create: accepts a computed (retainer) line with period", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1", pdfTemplate: "modern", timeEntryIds: [],
    computedLines: [{ sourceType: "retainer", periodMonth: "2026-06", label: "ריטיינר יוני", amount: 1500 }],
  });
  assert(r.success, "expected computed line to parse");
});
runner.test("create: rejects malformed periodMonth", () => {
  const r = createChargeDocumentSchema.safeParse({
    clientId: "c1", pdfTemplate: "modern", timeEntryIds: [],
    computedLines: [{ sourceType: "retainer", periodMonth: "2026/6", label: "x", amount: 1 }],
  });
  assert(!r.success, "expected bad periodMonth to fail");
});
runner.test("patchLine: edit description/notes parses", () => {
  const r = patchChargeLineSchema.safeParse({ lineId: "l1", description: "מכתב חדש", notes: "" });
  assert(r.success, "expected line edit to parse");
});

runner.test("patchDocument: empty object is rejected (no field to update)", () => {
  const r = patchChargeDocumentSchema.safeParse({});
  assert(!r.success, "expected empty patch to fail");
});
runner.test("patchDocument: single field passes", () => {
  const r = patchChargeDocumentSchema.safeParse({ notes: "עדכון" });
  assert(r.success, "expected single-field patch to parse");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
