/**
 * Unit tests for lib/db-retry.ts transient-connection-error detection.
 *
 * Covers the predicate behind the pool retry/error-handler fix for the
 * production Sentry issues CLOCK-BILL-3 ("Connection terminated unexpectedly")
 * and CLOCK-BILL-4 ("Connection terminated due to connection timeout").
 *
 * Imports the pure predicate from lib/db-retry.ts (no env / no DB import), so no
 * connection is opened and env validation is not triggered.
 */

import { isTransientConnectionError } from '../../lib/db-retry';

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => void }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => void) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('🧪 Running db-retry.ts tests...\n');

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

    console.log(`\n${this.passed} passed, ${this.failed} failed`);
    if (this.failed > 0) process.exit(1);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const runner = new TestRunner();

// --- Transient errors (must retry) ---

runner.test('detects "Connection terminated unexpectedly" (CLOCK-BILL-3)', () => {
  assert(
    isTransientConnectionError(new Error('Connection terminated unexpectedly')),
    'expected true for the CLOCK-BILL-3 message'
  );
});

runner.test('detects "Connection terminated due to connection timeout" (CLOCK-BILL-4)', () => {
  assert(
    isTransientConnectionError(new Error('Connection terminated due to connection timeout')),
    'expected true for the CLOCK-BILL-4 message'
  );
});

runner.test('detects "Client has encountered a connection error and is not queryable"', () => {
  assert(
    isTransientConnectionError(
      new Error('Client has encountered a connection error and is not queryable')
    ),
    'expected true for not-queryable client error'
  );
});

runner.test('detects "terminating connection due to administrator command"', () => {
  assert(
    isTransientConnectionError(new Error('terminating connection due to administrator command')),
    'expected true for admin-command termination'
  );
});

runner.test('detects ECONNRESET', () => {
  assert(
    isTransientConnectionError(new Error('read ECONNRESET')),
    'expected true for ECONNRESET'
  );
});

runner.test('detects EPIPE', () => {
  assert(isTransientConnectionError(new Error('write EPIPE')), 'expected true for EPIPE');
});

runner.test('matches case-insensitively', () => {
  assert(
    isTransientConnectionError(new Error('CONNECTION TERMINATED UNEXPECTEDLY')),
    'expected case-insensitive match'
  );
});

// --- Non-transient errors (must NOT retry) ---

runner.test('does not match a normal SQL constraint error', () => {
  assert(
    !isTransientConnectionError(
      new Error('null value in column "user_id" violates not-null constraint')
    ),
    'expected false for a constraint violation'
  );
});

runner.test('does not match a generic application error', () => {
  assert(
    !isTransientConnectionError(new Error('Invalid tenant user id; refusing to bind RLS context')),
    'expected false for an unrelated app error'
  );
});

// --- Non-Error inputs (must not throw) ---

runner.test('handles null without throwing', () => {
  assert(isTransientConnectionError(null) === false, 'expected false for null');
});

runner.test('handles a number without throwing', () => {
  assert(isTransientConnectionError(42) === false, 'expected false for a number');
});

runner.test('handles a transient message passed as a raw string', () => {
  assert(
    isTransientConnectionError('Connection terminated unexpectedly') === true,
    'expected true for a raw transient string'
  );
});

runner.run();
