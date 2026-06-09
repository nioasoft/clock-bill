/**
 * Unit tests for the shared entry body schema (item vs hourly rules) and the
 * "save item to client" body schema. Covers the ad-hoc-item guardrails:
 * an item line must carry a name + unit price + positive quantity.
 */
import { entryBodySchema } from "../../lib/schemas/entries";
import { addClientItemSchema } from "../../lib/schemas/rates";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;
  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }
  async run() {
    console.log("🧪 Running entry-item tests...\n");
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

const base = {
  projectId: "p1",
  date: "2026-06-01",
  description: "כתיבת מכתב",
};

const runner = new TestRunner();

// ── hourly lines ───────────────────────────────────────────────────────────
runner.test("hourly: valid with duration > 0", () => {
  const r = entryBodySchema.safeParse({ ...base, billingKind: "hourly", duration: 60 });
  assert(r.success, "expected hourly entry with duration to pass");
});
runner.test("hourly: rejects duration 0", () => {
  const r = entryBodySchema.safeParse({ ...base, billingKind: "hourly", duration: 0 });
  assert(!r.success, "expected hourly entry with duration 0 to fail");
});
runner.test("hourly: no rateLabel/rate required", () => {
  const r = entryBodySchema.safeParse({ ...base, billingKind: "hourly", duration: 30 });
  assert(r.success, "hourly should not require rateLabel/rate");
});

// ── item lines (ad-hoc or catalog) ──────────────────────────────────────────
runner.test("item: valid ad-hoc (name + price + quantity)", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 250, rateLabel: "מכתב",
  });
  assert(r.success, "expected valid ad-hoc item to pass");
});
runner.test("item: rejects missing rateLabel (unnamed item)", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 1, rate: 250,
  });
  assert(!r.success, "expected item without rateLabel to fail");
});
runner.test("item: rejects blank/whitespace rateLabel", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 1, rate: 250, rateLabel: "   ",
  });
  assert(!r.success, "expected item with blank rateLabel to fail");
});
runner.test("item: rejects missing rate (no unit price)", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 1, rateLabel: "מכתב",
  });
  assert(!r.success, "expected item without rate to fail");
});
runner.test("item: allows rate of 0 (free item)", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 1, rate: 0, rateLabel: "מכתב",
  });
  assert(r.success, "expected item with rate 0 to pass");
});
runner.test("item: rejects quantity 0", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 0, rate: 250, rateLabel: "מכתב",
  });
  assert(!r.success, "expected item with quantity 0 to fail");
});

// ── add-item-to-client body ─────────────────────────────────────────────────
runner.test("addClientItem: valid name + rate", () => {
  const r = addClientItemSchema.safeParse({ name: "מכתב", rate: 250 });
  assert(r.success, "expected valid add-item body to pass");
});
runner.test("addClientItem: trims and rejects empty name", () => {
  const r = addClientItemSchema.safeParse({ name: "   ", rate: 250 });
  assert(!r.success, "expected blank name to fail");
});
runner.test("addClientItem: rejects negative rate", () => {
  const r = addClientItemSchema.safeParse({ name: "מכתב", rate: -1 });
  assert(!r.success, "expected negative rate to fail");
});

// ── unit label (optional snapshot on item lines) ────────────────────────────
runner.test("item: unit validates and is trimmed", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 400, rateLabel: "פגישה", unit: " פגישה ",
  });
  assert(r.success, "item entry with unit should validate");
  if (r.success) assert(r.data.unit === "פגישה", `unit should be trimmed, got "${r.data.unit}"`);
});
runner.test("item: unit is optional", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 400, rateLabel: "פגישה",
  });
  assert(r.success, "item entry without unit should still validate");
});
runner.test("item: rejects unit longer than 30 chars", () => {
  const r = entryBodySchema.safeParse({
    ...base, billingKind: "item", duration: 0, quantity: 2, rate: 400, rateLabel: "פגישה", unit: "א".repeat(31),
  });
  assert(!r.success, "31-char unit should be rejected");
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
