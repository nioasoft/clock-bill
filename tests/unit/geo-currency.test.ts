/** Unit tests for lib/geo-currency.ts — country → suggested currency. */
import { currencyForCountry } from "../../lib/geo-currency";

function assertEqual(actual: unknown, expected: unknown, msg = "") {
  if (actual !== expected) throw new Error(`${msg} expected ${expected}, got ${actual}`);
}

let failed = 0;
function test(name: string, fn: () => void) {
  try { fn(); console.log(`✓ ${name}`); }
  catch (e) { failed++; console.error(`✗ ${name}: ${(e as Error).message}`); }
}

test("Israel → ILS", () => assertEqual(currencyForCountry("IL"), "ILS"));
test("US → USD", () => assertEqual(currencyForCountry("US"), "USD"));
test("EU member (DE) → EUR", () => assertEqual(currencyForCountry("DE"), "EUR"));
test("EU member (FR) → EUR", () => assertEqual(currencyForCountry("FR"), "EUR"));
test("lowercase il → ILS", () => assertEqual(currencyForCountry("il"), "ILS"));
test("unknown (GB) → ILS fallback", () => assertEqual(currencyForCountry("GB"), "ILS"));
test("null → ILS fallback", () => assertEqual(currencyForCountry(null), "ILS"));
test("undefined → ILS fallback", () => assertEqual(currencyForCountry(undefined), "ILS"));

if (failed > 0) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log("\nAll geo-currency tests passed");
