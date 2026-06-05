/**
 * Unit tests for lib/validation.ts
 * Testing form validation functions
 */

import {
  calculatePasswordStrength,
  validateField,
  validateEmail,
  validatePhone,
  validatePassword,
  validatePasswordConfirm,
  validateNumber,
  validateRequired,
  validateUrl,
  validateForm,
  validateDate,
  validateDateRange,
  validatePastDate,
  validateFutureDate,
  PasswordStrength,
} from '../../lib/validation';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running validation.ts tests...\n');

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

function assertFalse(value: boolean, message?: string) {
  if (value) {
    throw new Error(message || `Expected false but got ${value}`);
  }
}

// Create test runner
const runner = new TestRunner();

// calculatePasswordStrength tests
runner.test('calculatePasswordStrength: weak password', () => {
  const result = calculatePasswordStrength('abc');
  assertEqual(result.strength, PasswordStrength.WEAK);
  assertTrue(result.score < 40);
});

runner.test('calculatePasswordStrength: fair password', () => {
  const result = calculatePasswordStrength('abc12345');
  assertEqual(result.strength, PasswordStrength.FAIR);
  assertTrue(result.score >= 40 && result.score < 60);
});

runner.test('calculatePasswordStrength: fair password (no special char)', () => {
  // 8 chars, upper+lower+number, no special: 20 + 12 + 12 + 12 = 56 -> FAIR
  const result = calculatePasswordStrength('Abc12345');
  assertEqual(result.strength, PasswordStrength.FAIR);
  assertTrue(result.score >= 40 && result.score < 60);
});

runner.test('calculatePasswordStrength: strong password', () => {
  const result = calculatePasswordStrength('Abc12345!@#');
  assertEqual(result.strength, PasswordStrength.STRONG);
  assertTrue(result.score >= 80);
});

runner.test('calculatePasswordStrength: checks length', () => {
  const result = calculatePasswordStrength('Abc123!@#');
  assertTrue(result.checks.length);
  assertTrue(result.checks.lowercase); // 'Abc123!@#' contains lowercase b, c
  assertTrue(result.checks.uppercase);
  assertTrue(result.checks.number);
  assertTrue(result.checks.special);
});

runner.test('calculatePasswordStrength: checks all criteria', () => {
  const result = calculatePasswordStrength('abcABC123!@#');
  assertTrue(result.checks.length);
  assertTrue(result.checks.lowercase);
  assertTrue(result.checks.uppercase);
  assertTrue(result.checks.number);
  assertTrue(result.checks.special);
});

// validateField tests
runner.test('validateField: required field pass', () => {
  const result = validateField({ value: 'test', required: true });
  assertTrue(result.isValid);
  assertEqual(result.error, undefined);
});

runner.test('validateField: required field fail', () => {
  const result = validateField({ value: '', required: true });
  assertFalse(result.isValid);
  assertEqual(result.error, 'שדה חובה');
});

runner.test('validateField: minLength pass', () => {
  const result = validateField({ value: 'test', required: true, minLength: 3 });
  assertTrue(result.isValid);
});

runner.test('validateField: minLength fail', () => {
  const result = validateField({ value: 'te', required: true, minLength: 3 });
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('לפחות 3'));
});

runner.test('validateField: maxLength pass', () => {
  const result = validateField({ value: 'test', required: true, maxLength: 5 });
  assertTrue(result.isValid);
});

runner.test('validateField: maxLength fail', () => {
  const result = validateField({ value: 'testing', required: true, maxLength: 5 });
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('לכל היותר 5'));
});

runner.test('validateField: pattern pass', () => {
  const result = validateField({
    value: '123',
    required: true,
    pattern: /^\d+$/
  });
  assertTrue(result.isValid);
});

runner.test('validateField: pattern fail', () => {
  const result = validateField({
    value: 'abc',
    required: true,
    pattern: /^\d+$/
  });
  assertFalse(result.isValid);
  assertEqual(result.error, 'פורמט לא תקין');
});

runner.test('validateField: custom validation pass', () => {
  const result = validateField({
    value: 'test@example.com',
    required: true,
    custom: (v: string) => v.includes('@') ? null : { code: 'INVALID_EMAIL' }
  });
  assertTrue(result.isValid);
});

runner.test('validateField: custom validation fail', () => {
  const result = validateField({
    value: 'testexample.com',
    required: true,
    custom: (v: string) => v.includes('@') ? null : { code: 'INVALID_EMAIL' }
  });
  assertFalse(result.isValid);
  // Custom validators now return a stable ValidationError descriptor; the code
  // is surfaced on `result.code` and resolved to a localized string via the
  // Validation namespace (lib/validation-messages.ts).
  assertEqual(result.code?.code, 'INVALID_EMAIL');
});

// validateEmail tests
runner.test('validateEmail: valid email', () => {
  const result = validateEmail('test@example.com');
  assertTrue(result.isValid);
});

runner.test('validateEmail: invalid email no @', () => {
  const result = validateEmail('testexample.com');
  assertFalse(result.isValid);
  assertEqual(result.error, 'כתובת אימייל לא תקינה');
});

runner.test('validateEmail: invalid email no domain', () => {
  const result = validateEmail('test@');
  assertFalse(result.isValid);
});

runner.test('validateEmail: optional field empty', () => {
  const result = validateEmail('', false);
  assertTrue(result.isValid);
});

// validatePhone tests
runner.test('validatePhone: valid Israeli phone 05X', () => {
  const result = validatePhone('0521234567');
  assertTrue(result.isValid);
});

runner.test('validatePhone: valid Israeli phone with +972', () => {
  const result = validatePhone('+972521234567');
  assertTrue(result.isValid);
});

runner.test('validatePhone: valid Israeli phone with 0 prefix', () => {
  const result = validatePhone('09-1234567');
  assertTrue(result.isValid);
});

runner.test('validatePhone: invalid phone too short', () => {
  const result = validatePhone('052123');
  assertFalse(result.isValid);
  assertEqual(result.error, 'מספר טלפון לא תקין');
});

runner.test('validatePhone: invalid phone area code', () => {
  const result = validatePhone('011234567');
  assertFalse(result.isValid);
});

runner.test('validatePhone: optional field empty', () => {
  const result = validatePhone('', false);
  assertTrue(result.isValid);
});

// validatePassword tests
runner.test('validatePassword: valid password', () => {
  const result = validatePassword('password123');
  assertTrue(result.isValid);
});

runner.test('validatePassword: too short', () => {
  const result = validatePassword('pass');
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('לפחות 8'));
});

runner.test('validatePassword: empty', () => {
  const result = validatePassword('');
  assertFalse(result.isValid);
});

// validatePasswordConfirm tests
runner.test('validatePasswordConfirm: matching passwords', () => {
  const result = validatePasswordConfirm('password123', 'password123');
  assertTrue(result.isValid);
});

runner.test('validatePasswordConfirm: non-matching passwords', () => {
  const result = validatePasswordConfirm('password123', 'password456');
  assertFalse(result.isValid);
  assertEqual(result.error, 'הסיסמאות אינן תואמות');
});

runner.test('validatePasswordConfirm: empty confirm', () => {
  const result = validatePasswordConfirm('password123', '');
  assertFalse(result.isValid);
  assertEqual(result.error, 'שדה חובה');
});

// validateNumber tests
runner.test('validateNumber: valid number', () => {
  const result = validateNumber('100');
  assertTrue(result.isValid);
});

runner.test('validateNumber: valid decimal', () => {
  const result = validateNumber('99.99');
  assertTrue(result.isValid);
});

runner.test('validateNumber: invalid text', () => {
  const result = validateNumber('abc', true);
  assertFalse(result.isValid);
  assertEqual(result.error, 'חייב להיות מספר');
});

runner.test('validateNumber: below minimum', () => {
  const result = validateNumber('-5', true, 0);
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('גדול או שווה ל-0'));
});

runner.test('validateNumber: optional field empty', () => {
  const result = validateNumber('', false);
  assertTrue(result.isValid);
});

// validateRequired tests
runner.test('validateRequired: present value', () => {
  const result = validateRequired('test');
  assertTrue(result.isValid);
});

runner.test('validateRequired: empty string', () => {
  const result = validateRequired('');
  assertFalse(result.isValid);
  assertEqual(result.error, 'שדה חובה');
});

runner.test('validateRequired: whitespace only', () => {
  const result = validateRequired('   ');
  assertFalse(result.isValid);
});

runner.test('validateRequired: custom field name', () => {
  const result = validateRequired('', 'שם מלא');
  assertEqual(result.error, 'שם מלא הוא שדה חובה');
});

// validateUrl tests
runner.test('validateUrl: valid https URL', () => {
  const result = validateUrl('https://example.com');
  assertTrue(result.isValid);
});

runner.test('validateUrl: valid http URL', () => {
  const result = validateUrl('http://example.com');
  assertTrue(result.isValid);
});

runner.test('validateUrl: adds https prefix', () => {
  const result = validateUrl('example.com');
  assertTrue(result.isValid);
});

runner.test('validateUrl: invalid URL', () => {
  const result = validateUrl('not a url', true);
  assertFalse(result.isValid);
  assertEqual(result.error, 'כתובת אתר לא תקינה');
});

runner.test('validateUrl: optional field empty', () => {
  const result = validateUrl('', false);
  assertTrue(result.isValid);
});

// validateDate tests
runner.test('validateDate: valid date', () => {
  const result = validateDate('2024-01-15');
  assertTrue(result.isValid);
});

runner.test('validateDate: invalid format', () => {
  const result = validateDate('15/01/2024', true);
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('תאריך'));
});

runner.test('validateDate: invalid date (Feb 30)', () => {
  const result = validateDate('2024-02-30', true);
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('תאריך'));
});

runner.test('validateDate: leap year valid', () => {
  const result = validateDate('2024-02-29');
  assertTrue(result.isValid);
});

runner.test('validateDate: leap year invalid', () => {
  const result = validateDate('2023-02-29', true);
  assertFalse(result.isValid);
});

runner.test('validateDate: optional field empty', () => {
  const result = validateDate('', false);
  assertTrue(result.isValid);
});

// validateDateRange tests
runner.test('validateDateRange: valid range', () => {
  const result = validateDateRange('2024-01-01', '2024-01-31');
  assertTrue(result.isValid);
});

runner.test('validateDateRange: start after end', () => {
  const result = validateDateRange('2024-01-31', '2024-01-01', true);
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('לפני'));
});

runner.test('validateDateRange: invalid start date', () => {
  const result = validateDateRange('invalid', '2024-01-31', true);
  assertFalse(result.isValid);
});

runner.test('validateDateRange: optional fields empty', () => {
  const result = validateDateRange('', '', false);
  assertTrue(result.isValid);
});

// validatePastDate tests
runner.test('validatePastDate: past date valid', () => {
  const result = validatePastDate('2024-01-01'); // Assuming today is after this
  assertTrue(result.isValid);
});

runner.test('validatePastDate: future date invalid', () => {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const result = validatePastDate(futureDate.toISOString().split('T')[0], true);
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('עתיד'));
});

runner.test('validatePastDate: optional field empty', () => {
  const result = validatePastDate('', false);
  assertTrue(result.isValid);
});

// validateFutureDate tests
runner.test('validateFutureDate: future date valid', () => {
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const result = validateFutureDate(futureDate.toISOString().split('T')[0]);
  assertTrue(result.isValid);
});

runner.test('validateFutureDate: past date invalid', () => {
  const result = validateFutureDate('2020-01-01', true);
  assertFalse(result.isValid);
  assertTrue(result.error!.includes('עבר'));
});

runner.test('validateFutureDate: optional field empty', () => {
  const result = validateFutureDate('', false);
  assertTrue(result.isValid);
});

// validateForm tests
runner.test('validateForm: multiple fields all valid', () => {
  const result = validateForm(
    { name: 'Test', email: 'test@example.com' },
    {
      name: (v: string) => validateRequired(v),
      email: (v: string) => validateEmail(v)
    }
  );
  assertTrue(result.isValid);
  assertEqual(result.errors.name, undefined);
  assertEqual(result.errors.email, undefined);
});

runner.test('validateForm: multiple fields one invalid', () => {
  const result = validateForm(
    { name: 'Test', email: 'invalid-email' },
    {
      name: (v: string) => validateRequired(v),
      email: (v: string) => validateEmail(v)
    }
  );
  assertFalse(result.isValid);
  assertEqual(result.errors.name, undefined);
  assertTrue(result.errors.email!.length > 0);
});

runner.test('validateForm: multiple fields all invalid', () => {
  const result = validateForm(
    { name: '', email: 'invalid' },
    {
      name: (v: string) => validateRequired(v),
      email: (v: string) => validateEmail(v)
    }
  );
  assertFalse(result.isValid);
  assertTrue(result.errors.name!.length > 0);
  assertTrue(result.errors.email!.length > 0);
});

// Run tests
runner.run().then(success => {
  process.exit(success ? 0 : 1);
});
