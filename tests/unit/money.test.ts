/**
 * Unit tests for lib/money.ts
 * Verifies money math avoids floating-point drift.
 */

import {
  toCents,
  fromCents,
  roundMoney,
  addMoney,
  sumMoney,
  calcHourlyAmount,
} from '../../lib/money';

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running money.ts tests...\n');
    for (const { name, fn } of this.tests) {
      try {
        fn();
        this.passed++;
        console.log(`  ✅ ${name}`);
      } catch (error) {
        this.failed++;
        console.error(`  ❌ ${name}`);
        if (error instanceof Error) {
          console.error(`     ${error.message}`);
        }
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

const runner = new TestRunner();

// --- toCents / fromCents ---
runner.test('toCents: rounds to whole agorot', () => {
  assertEqual(toCents(1.005), 101);
  assertEqual(toCents(158.333333), 15833);
  assertEqual(toCents(0), 0);
});

runner.test('fromCents: converts back to currency units', () => {
  assertEqual(fromCents(15833), 158.33);
  assertEqual(fromCents(0), 0);
});

runner.test('toCents: handles non-finite as 0', () => {
  assertEqual(toCents(NaN), 0);
  assertEqual(toCents(Infinity), 0);
});

// --- roundMoney ---
runner.test('roundMoney: 2 decimals', () => {
  assertEqual(roundMoney(158.333333), 158.33);
  assertEqual(roundMoney(0.1 + 0.2), 0.3);
});

// --- addMoney ---
runner.test('addMoney: no float drift', () => {
  assertEqual(addMoney(0.1, 0.2), 0.3);
  assertEqual(addMoney(158.33, 41.67), 200);
});

// --- sumMoney ---
runner.test('sumMoney: precise accumulation', () => {
  // 0.1 added 10 times = 1.0 exactly (naive float gives 0.9999999999999999)
  assertEqual(sumMoney(Array(10).fill(0.1)), 1);
  assertEqual(sumMoney([158.33, 41.67, 100]), 300);
});

runner.test('sumMoney: empty list is 0', () => {
  assertEqual(sumMoney([]), 0);
});

// --- calcHourlyAmount ---
runner.test('calcHourlyAmount: 95 min @ 100/hr', () => {
  // 95/60 * 100 = 158.3333... -> 158.33
  assertEqual(calcHourlyAmount(95, 100), 158.33);
});

runner.test('calcHourlyAmount: 60 min @ 250/hr', () => {
  assertEqual(calcHourlyAmount(60, 250), 250);
});

runner.test('calcHourlyAmount: null/zero rate is 0', () => {
  assertEqual(calcHourlyAmount(120, null), 0);
  assertEqual(calcHourlyAmount(120, 0), 0);
  assertEqual(calcHourlyAmount(120, undefined), 0);
});

runner.test('calcHourlyAmount: summing rounded lines stays exact', () => {
  // Three 95-minute lines at 100/hr: each 158.33, total 474.99
  const lines = [95, 95, 95].map((m) => calcHourlyAmount(m, 100));
  assertEqual(sumMoney(lines), 474.99);
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
