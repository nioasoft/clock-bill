import he from "../../messages/he.json";
import en from "../../messages/en.json";

function keyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k)
  );
}

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running i18n-parity tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`  ✅ ${name}`); }
      catch (e) { this.failed++; console.error(`  ❌ ${name}`); if (e instanceof Error) console.error(`     ${e.message}`); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}
const runner = new TestRunner();
runner.test("he and en have identical key sets", () => {
  const h = new Set(keyPaths(he));
  const e = new Set(keyPaths(en));
  const onlyHe = [...h].filter((k) => !e.has(k));
  const onlyEn = [...e].filter((k) => !h.has(k));
  if (onlyHe.length || onlyEn.length) {
    throw new Error(`Key mismatch.\n  only in he: ${onlyHe.join(", ") || "—"}\n  only in en: ${onlyEn.join(", ") || "—"}`);
  }
});
runner.run();
