import {
  readRecentWorkContext,
  writeRecentWorkContext,
  RECENT_WORK_CONTEXT_STORAGE_KEY,
} from "../../lib/recent-work-context";
class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private failures = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  run() {
    for (const test of this.tests) {
      try { test.fn(); console.log(`  ✅ ${test.name}`); }
      catch (error) { this.failures += 1; console.error(`  ❌ ${test.name}`, error); }
    }
    if (this.failures > 0) process.exit(1);
  }
}

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

const runner = new TestRunner();

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

runner.test("round-trips a safe recent selection", () => {
  const storage = memoryStorage();
  writeRecentWorkContext(
    { projectId: "project-1", clientId: "client-1", rateId: "rate-1", billingKind: "hourly" },
    storage,
    1_000
  );
  assertEqual(readRecentWorkContext(storage, 2_000)?.projectId, "project-1");
  assertEqual(readRecentWorkContext(storage, 2_000)?.rateId, "rate-1");
});

runner.test("ignores expired, malformed, and future values", () => {
  const storage = memoryStorage();
  storage.setItem(
    RECENT_WORK_CONTEXT_STORAGE_KEY,
    JSON.stringify({ projectId: "p", clientId: "c", billingKind: "hourly", updatedAt: 1 })
  );
  assertEqual(readRecentWorkContext(storage, 100 * 24 * 60 * 60 * 1000), null);
  storage.setItem(RECENT_WORK_CONTEXT_STORAGE_KEY, "not-json");
  assertEqual(readRecentWorkContext(storage, 10), null);
  storage.setItem(
    RECENT_WORK_CONTEXT_STORAGE_KEY,
    JSON.stringify({ projectId: "p", clientId: "c", billingKind: "hourly", updatedAt: 20 })
  );
  assertEqual(readRecentWorkContext(storage, 10), null);
});

runner.test("storage failures do not escape", () => {
  const storage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
  };
  writeRecentWorkContext({ projectId: "p", clientId: "c", billingKind: "hourly" }, storage, 1);
  assertEqual(readRecentWorkContext(storage, 1), null);
});

runner.run();
