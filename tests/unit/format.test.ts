/**
 * Unit tests for lib/format.ts
 * Testing date/time formatting functions
 */

import {
  formatDate,
  formatTime,
  formatDateTime,
  formatDateRange,
  formatDuration,
} from '../../lib/format';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running format.ts tests...\n');

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
    throw new Error(
      message || `Expected "${expected}" but got "${actual}"`
    );
  }
}

function assertTrue(value: boolean, message?: string) {
  if (!value) {
    throw new Error(message || `Expected true but got ${value}`);
  }
}

// Create test runner
const runner = new TestRunner();

// formatDate tests
runner.test('formatDate: DD/MM/YYYY format', () => {
  const date = new Date('2024-01-15');
  const result = formatDate(date, 'DD/MM/YYYY');
  assertEqual(result, '15/01/2024');
});

runner.test('formatDate: MM/DD/YYYY format', () => {
  const date = new Date('2024-01-15');
  const result = formatDate(date, 'MM/DD/YYYY');
  assertEqual(result, '01/15/2024');
});

runner.test('formatDate: YYYY-MM-DD format', () => {
  const date = new Date('2024-01-15');
  const result = formatDate(date, 'YYYY-MM-DD');
  assertEqual(result, '2024-01-15');
});

runner.test('formatDate: handles string input', () => {
  const result = formatDate('2024-01-15', 'DD/MM/YYYY');
  assertEqual(result, '15/01/2024');
});

runner.test('formatDate: handles invalid date', () => {
  const result = formatDate('invalid', 'DD/MM/YYYY');
  assertEqual(result, '');
});

runner.test('formatDate: pads single digit day/month', () => {
  const date = new Date('2024-01-05');
  const result = formatDate(date, 'DD/MM/YYYY');
  assertEqual(result, '05/01/2024');
});

// formatTime tests
runner.test('formatTime: 24h format', () => {
  const date = new Date('2024-01-15T14:30:00');
  const result = formatTime(date, '24h');
  assertEqual(result, '14:30');
});

runner.test('formatTime: 12h format PM', () => {
  const date = new Date('2024-01-15T14:30:00');
  const result = formatTime(date, '12h');
  assertEqual(result, '2:30 PM');
});

runner.test('formatTime: 12h format AM', () => {
  const date = new Date('2024-01-15T08:30:00');
  const result = formatTime(date, '12h');
  assertEqual(result, '8:30 AM');
});

runner.test('formatTime: 12h format midnight', () => {
  const date = new Date('2024-01-15T00:30:00');
  const result = formatTime(date, '12h');
  assertEqual(result, '12:30 AM');
});

runner.test('formatTime: 12h format noon', () => {
  const date = new Date('2024-01-15T12:30:00');
  const result = formatTime(date, '12h');
  assertEqual(result, '12:30 PM');
});

runner.test('formatTime: pads single digit minutes', () => {
  const date = new Date('2024-01-15T14:05:00');
  const result = formatTime(date, '24h');
  assertEqual(result, '14:05');
});

runner.test('formatTime: handles invalid time', () => {
  const result = formatTime('invalid', '24h');
  assertEqual(result, '');
});

// formatDateTime tests
runner.test('formatDateTime: combines date and time', () => {
  const date = new Date('2024-01-15T14:30:00');
  const result = formatDateTime(date, {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h'
  });
  assertEqual(result, '15/01/2024 14:30');
});

runner.test('formatDateTime: 12h time format', () => {
  const date = new Date('2024-01-15T14:30:00');
  const result = formatDateTime(date, {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h'
  });
  assertEqual(result, '15/01/2024 2:30 PM');
});

runner.test('formatDateTime: handles invalid datetime', () => {
  const result = formatDateTime('invalid', {
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h'
  });
  assertEqual(result, '');
});

// formatDateRange tests
runner.test('formatDateRange: formats date range', () => {
  const start = new Date('2024-01-01');
  const end = new Date('2024-01-31');
  const result = formatDateRange(start, end, 'DD/MM/YYYY');
  assertEqual(result, '01/01/2024 - 31/01/2024');
});

runner.test('formatDateRange: handles string input', () => {
  const result = formatDateRange('2024-01-01', '2024-01-31', 'DD/MM/YYYY');
  assertEqual(result, '01/01/2024 - 31/01/2024');
});

// formatDuration tests
runner.test('formatDuration: minutes only', () => {
  const result = formatDuration(30);
  assertEqual(result, '30 דק׳');
});

runner.test('formatDuration: hours only', () => {
  const result = formatDuration(120);
  assertEqual(result, '2 שע׳');
});

runner.test('formatDuration: hours and minutes', () => {
  const result = formatDuration(150);
  assertEqual(result, '2 שע׳ 30 דק׳');
});

runner.test('formatDuration: zero minutes', () => {
  const result = formatDuration(0);
  assertEqual(result, '0 דק׳');
});

runner.test('formatDuration: large duration', () => {
  const result = formatDuration(605);
  assertEqual(result, '10 שע׳ 5 דק׳');
});

// Edge cases
runner.test('formatDate: handles leap year', () => {
  const date = new Date('2024-02-29');
  const result = formatDate(date, 'DD/MM/YYYY');
  assertEqual(result, '29/02/2024');
});

runner.test('formatDate: handles last day of month', () => {
  const date = new Date('2024-01-31');
  const result = formatDate(date, 'DD/MM/YYYY');
  assertEqual(result, '31/01/2024');
});

runner.test('formatTime: handles end of day', () => {
  const date = new Date('2024-01-15T23:59:00');
  const result = formatTime(date, '24h');
  assertEqual(result, '23:59');
});

runner.test('formatTime: handles start of day', () => {
  const date = new Date('2024-01-15T00:00:00');
  const result = formatTime(date, '24h');
  assertEqual(result, '00:00');
});

// Run tests
runner.run().then(success => {
  process.exit(success ? 0 : 1);
});
