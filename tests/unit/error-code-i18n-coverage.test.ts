/**
 * Regression test: every ErrorCode in ERROR_CODES must have a non-empty
 * translation under errors.<CODE> in BOTH he.json and en.json.
 *
 * Prevents the class of bug where a new error code is wired into plan-guard /
 * API routes but the i18n key is missing from one or both locales, causing the
 * raw key path to be shown to users.
 */
import { ERROR_CODES } from "../../lib/error-codes";
import he from "../../messages/he.json";
import en from "../../messages/en.json";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log("🧪 Running error-code-i18n-coverage tests...\n");
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
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}

const runner = new TestRunner();

runner.test("every ERROR_CODE has a non-empty entry in he.json errors namespace", () => {
  const heErrors = (he as Record<string, unknown>)["errors"] as Record<string, string> | undefined;
  if (!heErrors) throw new Error('he.json is missing the top-level "errors" key');

  const missing: string[] = [];
  for (const code of ERROR_CODES) {
    const val = heErrors[code];
    if (typeof val !== "string" || val.trim() === "") {
      missing.push(code);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing or empty in he.json errors: ${missing.join(", ")}`);
  }
});

runner.test("every ERROR_CODE has a non-empty entry in en.json errors namespace", () => {
  const enErrors = (en as Record<string, unknown>)["errors"] as Record<string, string> | undefined;
  if (!enErrors) throw new Error('en.json is missing the top-level "errors" key');

  const missing: string[] = [];
  for (const code of ERROR_CODES) {
    const val = enErrors[code];
    if (typeof val !== "string" || val.trim() === "") {
      missing.push(code);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing or empty in en.json errors: ${missing.join(", ")}`);
  }
});

runner.test("he.json and en.json errors namespace have identical keys", () => {
  const heErrors = Object.keys((he as Record<string, unknown>)["errors"] as Record<string, string> ?? {});
  const enErrors = Object.keys((en as Record<string, unknown>)["errors"] as Record<string, string> ?? {});
  const heSet = new Set(heErrors);
  const enSet = new Set(enErrors);
  const onlyHe = heErrors.filter((k) => !enSet.has(k));
  const onlyEn = enErrors.filter((k) => !heSet.has(k));
  if (onlyHe.length || onlyEn.length) {
    throw new Error(
      `errors namespace key mismatch.\n  only in he: ${onlyHe.join(", ") || "—"}\n  only in en: ${onlyEn.join(", ") || "—"}`
    );
  }
});

runner.run();
