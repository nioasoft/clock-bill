/** Unit tests for lib/schemas/tasks.ts */
import { createTaskSchema, updateTaskSchema, moveTaskSchema } from "../../lib/schemas/tasks";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running tasks-schema tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}
function assertTrue(c: boolean, m?: string) { if (!c) throw new Error(m || "expected true"); }
function assertFalse(c: boolean, m?: string) { if (c) throw new Error(m || "expected false"); }
const runner = new TestRunner();

const validCreate = {
  clientId: "c1", projectId: "p1", rateId: "r1",
  title: "כתיבת דוח", notes: "פרטים", priority: "high",
  dueDate: "2026-06-30", tags: ["דחוף"],
};

runner.test("create: valid payload passes", () => {
  assertTrue(createTaskSchema.safeParse(validCreate).success);
});
runner.test("create: missing clientId fails (client required)", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, clientId: "" }).success);
});
runner.test("create: missing projectId fails", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, projectId: undefined }).success);
});
runner.test("create: missing rateId fails (rate required)", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, rateId: "" }).success);
});
runner.test("create: empty title fails", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, title: "  " }).success);
});
runner.test("create: bad priority fails", () => {
  assertFalse(createTaskSchema.safeParse({ ...validCreate, priority: "later" }).success);
});
runner.test("create: dueDate omitted is allowed", () => {
  // dueDate is destructured only to omit it from the rest object.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dueDate, ...noDue } = validCreate;
  assertTrue(createTaskSchema.safeParse(noDue).success);
});
runner.test("create: defaults priority to normal and tags to []", () => {
  const parsed = createTaskSchema.parse({ clientId: "c", projectId: "p", rateId: "r", title: "x" });
  assertTrue(parsed.priority === "normal" && Array.isArray(parsed.tags) && parsed.tags.length === 0);
});
runner.test("move: valid status + position passes", () => {
  assertTrue(moveTaskSchema.safeParse({ status: "in_progress", position: 1500 }).success);
});
runner.test("move: bad status fails", () => {
  assertFalse(moveTaskSchema.safeParse({ status: "archived", position: 1 }).success);
});
runner.test("update: partial payload (title only) passes", () => {
  assertTrue(updateTaskSchema.safeParse({ title: "שם חדש" }).success);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
