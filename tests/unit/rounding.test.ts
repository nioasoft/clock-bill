/**
 * Unit tests for lib/rounding.ts
 * Verifies hourly billing time-rounding (always rounds UP) and mode resolution.
 */

import {
  roundBillableMinutes,
  resolveRounding,
  asRoundingMode,
} from '../../lib/rounding';

class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running rounding.ts tests...\n');
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

// --- none ---
runner.test('none: passthrough', () => {
  assertEqual(roundBillableMinutes(50, 'none'), 50);
  assertEqual(roundBillableMinutes(0, 'none'), 0);
  assertEqual(roundBillableMinutes(123, 'none'), 123);
});

// --- hour_up ---
runner.test('hour_up: 50 → 60', () => {
  assertEqual(roundBillableMinutes(50, 'hour_up'), 60);
});
runner.test('hour_up: exact 60 stays 60', () => {
  assertEqual(roundBillableMinutes(60, 'hour_up'), 60);
});
runner.test('hour_up: 61 → 120', () => {
  assertEqual(roundBillableMinutes(61, 'hour_up'), 120);
});
runner.test('hour_up: 1 → 60', () => {
  assertEqual(roundBillableMinutes(1, 'hour_up'), 60);
});

// --- half_hour_up ---
runner.test('half_hour_up: 35 → 60', () => {
  assertEqual(roundBillableMinutes(35, 'half_hour_up'), 60);
});
runner.test('half_hour_up: exact 30 stays 30', () => {
  assertEqual(roundBillableMinutes(30, 'half_hour_up'), 30);
});
runner.test('half_hour_up: 20 → 30', () => {
  assertEqual(roundBillableMinutes(20, 'half_hour_up'), 30);
});
runner.test('half_hour_up: 50 → 60', () => {
  assertEqual(roundBillableMinutes(50, 'half_hour_up'), 60);
});

// --- edge: non-positive ---
runner.test('non-positive durations are untouched', () => {
  assertEqual(roundBillableMinutes(0, 'hour_up'), 0);
  assertEqual(roundBillableMinutes(-5, 'half_hour_up'), -5);
});

// --- resolveRounding ---
runner.test('resolveRounding: project override wins', () => {
  assertEqual(resolveRounding('hour_up', 'none'), 'hour_up');
  assertEqual(resolveRounding('none', 'hour_up'), 'none');
});
runner.test('resolveRounding: null project inherits client', () => {
  assertEqual(resolveRounding(null, 'half_hour_up'), 'half_hour_up');
  assertEqual(resolveRounding(undefined, 'hour_up'), 'hour_up');
});
runner.test('resolveRounding: both empty → none', () => {
  assertEqual(resolveRounding(null, null), 'none');
  assertEqual(resolveRounding('', ''), 'none');
});

// --- asRoundingMode ---
runner.test('asRoundingMode: narrows unknown to none', () => {
  assertEqual(asRoundingMode('garbage'), 'none');
  assertEqual(asRoundingMode(null), 'none');
  assertEqual(asRoundingMode('hour_up'), 'hour_up');
});

runner.run().then((ok) => process.exit(ok ? 0 : 1));
