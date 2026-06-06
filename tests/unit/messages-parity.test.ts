/**
 * Ensures messages/he.json and messages/en.json have identical key trees —
 * no missing or extra keys in either locale. This guards every later i18n
 * phase: whenever a string is externalized, both catalogs must stay in sync.
 *
 * Runs standalone via `tsx` (the project's custom runner in tests/run-tests.ts
 * executes each *.test.ts file and treats a non-zero exit as a failure).
 */
import he from "../../messages/he.json";
import en from "../../messages/en.json";

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object"
      ? flatten(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

function run(): void {
  const heKeys = new Set(flatten(he as Record<string, unknown>));
  const enKeys = new Set(flatten(en as Record<string, unknown>));
  const missingInEn = [...heKeys].filter((k) => !enKeys.has(k));
  const missingInHe = [...enKeys].filter((k) => !heKeys.has(k));

  if (missingInEn.length || missingInHe.length) {
    throw new Error(
      `Message key mismatch.\nMissing in en: ${missingInEn.join(", ")}\nMissing in he: ${missingInHe.join(", ")}`
    );
  }
  console.log(`✅ messages-parity: OK (${heKeys.size} keys)`);
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ messages-parity:", error instanceof Error ? error.message : error);
  process.exit(1);
}
