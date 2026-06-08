/**
 * Unit tests for lib/professions.ts — registry integrity.
 * Every preset must reference valid rounding modes and PDF templates.
 */
import { PROFESSIONS, isProfessionId, getProfession } from "../../lib/professions";
import { ROUNDING_MODES } from "../../lib/rounding";
import { KNOWN_TEMPLATES } from "../../lib/schemas/charge-documents";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`✗ ${name}: ${(e as Error).message}`);
  }
}

test("has at least 8 professions including 'other'", () => {
  assert(PROFESSIONS.length >= 8, `expected >=8, got ${PROFESSIONS.length}`);
  assert(PROFESSIONS.some((p) => p.id === "other"), "missing 'other'");
});

test("ids are unique", () => {
  const ids = PROFESSIONS.map((p) => p.id);
  assert(new Set(ids).size === ids.length, "duplicate profession ids");
});

test("every preset uses a valid rounding mode", () => {
  for (const p of PROFESSIONS) {
    assert(
      (ROUNDING_MODES as readonly string[]).includes(p.defaults.defaultBillingRounding),
      `${p.id}: invalid rounding ${p.defaults.defaultBillingRounding}`
    );
  }
});

test("every preset uses a valid PDF template", () => {
  for (const p of PROFESSIONS) {
    assert(
      (KNOWN_TEMPLATES as readonly string[]).includes(p.defaults.preferredPdfTemplate),
      `${p.id}: invalid template ${p.defaults.preferredPdfTemplate}`
    );
  }
});

test("every preset has he + en labels and model hints", () => {
  for (const p of PROFESSIONS) {
    assert(!!p.labelHe && !!p.labelEn, `${p.id}: missing label`);
    assert(!!p.modelHintHe && !!p.modelHintEn, `${p.id}: missing model hint`);
  }
});

test("isProfessionId + getProfession", () => {
  assert(isProfessionId("lawyer"), "lawyer should be valid");
  assert(!isProfessionId("nope"), "nope should be invalid");
  assert(getProfession("lawyer")?.id === "lawyer", "getProfession lawyer");
  assert(getProfession("nope") === undefined, "getProfession nope");
});

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll profession tests passed");
