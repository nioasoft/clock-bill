/**
 * Unit tests for lib/currency.ts
 * Locale-aware currency formatting (fiat via Intl, crypto via symbol + grouping).
 *
 * Runs standalone via `tsx` (the project's custom runner in tests/run-tests.ts
 * executes each *.test.ts file and treats a non-zero exit as a failure).
 */
import { formatCurrency, CURRENCY_SYMBOLS } from "../../lib/currency";

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  run(): boolean {
    console.log("🧪 Running currency-format.ts tests...\n");
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (error instanceof Error) console.error(`     ${error.message}`);
      }
    }
    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed`);
    return this.failed === 0;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}

function assertContains(haystack: string, needle: string) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected "${haystack}" to contain "${needle}"`);
  }
}

const runner = new TestRunner();

// --- Fiat (English, en-US) ---
runner.test("formatCurrency: USD en gives $ + grouping + 2 decimals", () => {
  assertEqual(formatCurrency(1234.5, "USD", "en"), "$1,234.50");
});

runner.test("formatCurrency: USD en zero", () => {
  assertEqual(formatCurrency(0, "USD", "en"), "$0.00");
});

runner.test("formatCurrency: USD en rounds to 2 decimals", () => {
  assertEqual(formatCurrency(99.999, "USD", "en"), "$100.00");
});

// --- Fiat (Hebrew, he-IL) ---
runner.test("formatCurrency: ILS he has ₪ symbol and grouping", () => {
  const result = formatCurrency(1234.5, "ILS", "he");
  assertContains(result, "₪");
  // he-IL groups thousands with a comma: "1,234.50"
  assertContains(result, "1,234.50");
});

runner.test("formatCurrency: USD he still renders (has $ glyph)", () => {
  const result = formatCurrency(1000, "USD", "he");
  assertContains(result, "1,000.00");
});

// --- Crypto (no ISO code → symbol + grouped number) ---
runner.test("formatCurrency: BTC en keeps up to 8 fraction digits", () => {
  assertEqual(formatCurrency(0.12345678, "BTC", "en"), "₿0.12345678");
});

runner.test("formatCurrency: BTC en pads to min 2 decimals", () => {
  assertEqual(formatCurrency(1, "BTC", "en"), "₿1.00");
});

runner.test("formatCurrency: USDT en 2 decimals + grouping", () => {
  assertEqual(formatCurrency(1000, "USDT", "en"), "₮1,000.00");
});

runner.test("formatCurrency: ETH en caps at 6 fraction digits", () => {
  assertEqual(formatCurrency(0.123456789, "ETH", "en"), "Ξ0.123457");
});

runner.test("formatCurrency: USDT he groups thousands", () => {
  const result = formatCurrency(1234.5, "USDT", "he");
  assertContains(result, "₮");
  assertContains(result, "1,234.50");
});

// --- Defaults & symbol map integrity ---
runner.test("formatCurrency: defaults to he locale", () => {
  assertEqual(formatCurrency(1000, "USDT"), formatCurrency(1000, "USDT", "he"));
});

runner.test("CURRENCY_SYMBOLS: all five currencies present", () => {
  for (const code of ["ILS", "USD", "USDT", "BTC", "ETH"]) {
    if (!CURRENCY_SYMBOLS[code]) {
      throw new Error(`Missing symbol for ${code}`);
    }
  }
});

process.exit(runner.run() ? 0 : 1);
