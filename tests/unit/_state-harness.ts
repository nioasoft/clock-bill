/**
 * Tiny shared harness for the state-machine spec tests (tests/unit/state-*.test.ts).
 * Not a test file itself (no `.test.ts` suffix), so run-tests.ts skips it.
 *
 * `need()` resolves an export that may not exist yet, so a missing function
 * fails ONE test with a readable message instead of crashing the whole file.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Fn = (...args: never[]) => unknown;

export function need<T extends Fn>(mod: unknown, name: string): T {
  const fn = (mod as Record<string, unknown> | null)?.[name];
  if (typeof fn !== "function") throw new Error(`missing export: ${name}()`);
  return fn as T;
}

/** Import a module that may not exist yet; resolves to null instead of throwing. */
export async function tryImport(path: string): Promise<unknown> {
  try {
    return await import(path);
  } catch {
    return null;
  }
}

export function src(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

export function eq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
}

export function ok(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

/** Run named tests; exit 1 if any fail (run-tests.ts reads the exit code). */
export async function run(title: string, tests: Array<[string, () => unknown]>): Promise<void> {
  console.log(`🧪 ${title}\n`);
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (e) {
      failed++;
      console.error(`  ❌ ${name}\n     ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  console.log(`\n📊 Results: ${tests.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
