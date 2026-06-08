/** Unit tests for lib/themes.ts — registry + guard (pure logic). */
import { THEMES, DEFAULT_THEME, isThemeId } from "../../lib/themes";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0; private failed = 0;
  test(name: string, fn: () => void) { this.tests.push({ name, fn }); }
  async run() {
    console.log("🧪 Running themes.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try { fn(); this.passed++; console.log(`✅ ${name}`); }
      catch (e) { this.failed++; console.log(`❌ ${name}`); console.error(e); }
    }
    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    process.exit(this.failed > 0 ? 1 : 0);
  }
}
function assertEqual(a: unknown, b: unknown, msg?: string) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

const r = new TestRunner();
r.test("default theme is dark", () => assertEqual(DEFAULT_THEME, "dark"));
r.test("registry contains the default", () =>
  assertEqual(THEMES.some((t) => t.id === DEFAULT_THEME), true));
r.test("every theme has labels + 3 swatches", () =>
  assertEqual(THEMES.every((t) => !!t.labelHe && !!t.labelEn && t.swatch.length === 3), true));
r.test("isThemeId accepts a registered id", () => assertEqual(isThemeId("dark"), true));
r.test("isThemeId rejects junk", () => assertEqual(isThemeId("neon-pink"), false));
r.test("isThemeId rejects non-string", () => assertEqual(isThemeId(42), false));
r.test("registry has all 12 themes", () => assertEqual(THEMES.length, 12));
r.test("ids include dark, daylight, obsidian", () =>
  assertEqual(["dark", "daylight", "obsidian"].every((id) => THEMES.some((t) => t.id === id)), true));
r.test("isThemeId accepts daylight", () => assertEqual(isThemeId("daylight"), true));
r.test("isThemeId rejects midnight (we use id 'dark')", () => assertEqual(isThemeId("midnight"), false));
r.test("every id is lowercase a-z (inline cookie script safe)", () =>
  assertEqual(THEMES.every((t) => /^[a-z]+$/.test(t.id)), true));
r.run();
