import { strict as assert } from "node:assert";
import {
  makeReconciliationKey,
  parseReconciliationCsv,
  suggestCandidate,
  type ReconciliationCandidate,
} from "../../lib/payment-reconciliation";
import { applyReconciliationSchema } from "../../lib/schemas/payment-reconciliation";

const rows = parseReconciliationCsv(
  '\uFEFFתאריך,סכום,מטבע,אסמכתא,תיאור\n10/07/2026,"1,250.50",ILS,1042,"העברה, אלפא"'
);
assert.equal(rows.length, 1);
assert.deepEqual(rows[0], {
  id: "1",
  paidAt: "2026-07-10",
  amount: 1250.5,
  currency: "ILS",
  reference: "1042",
  description: "העברה, אלפא",
});

const candidates: ReconciliationCandidate[] = [
  { id: "doc-a", documentNumber: 1042, clientName: "אלפא", issuedAt: "2026-07-01", currency: "ILS", outstanding: 1250.5 },
  { id: "doc-b", documentNumber: 1043, clientName: "בטא", issuedAt: "2026-07-02", currency: "ILS", outstanding: 1250.5 },
];
assert.equal(suggestCandidate(rows[0], candidates)?.id, "doc-a", "document reference should win");
assert.equal(suggestCandidate({ ...rows[0], reference: "", description: "" }, candidates), null, "ambiguous amount-only match must require review");
assert.equal(suggestCandidate({ ...rows[0], currency: "USD" }, candidates), null, "currency must match");
assert.equal(makeReconciliationKey("batch", "1", "doc-a"), "recon:batch:1:doc-a");

assert.throws(() => parseReconciliationCsv("date,description\n2026-07-10,test"), /MISSING_COLUMNS/);
assert.throws(() => parseReconciliationCsv("date,amount\nnot-a-date,20"), /INVALID_ROW/);
assert.throws(() => parseReconciliationCsv("date,amount\n2026-02-30,20"), /INVALID_ROW/);

const valid = {
  confirmed: true,
  matches: [{
    documentId: "doc-a",
    amount: 1250.5,
    paidAt: "2026-07-10",
    method: "bank_transfer",
    note: "1042",
    reconciliationKey: "recon:batch:1:doc-a",
  }],
};
assert.equal(applyReconciliationSchema.safeParse(valid).success, true);
assert.equal(applyReconciliationSchema.safeParse({ ...valid, confirmed: false }).success, false, "confirmation is required");
assert.equal(applyReconciliationSchema.safeParse({ ...valid, matches: [valid.matches[0], valid.matches[0]] }).success, false, "duplicate keys are rejected");
assert.equal(applyReconciliationSchema.safeParse({ ...valid, matches: [{ ...valid.matches[0], amount: 0 }] }).success, false);
assert.equal(applyReconciliationSchema.safeParse({ ...valid, matches: [{ ...valid.matches[0], paidAt: "2026-02-30" }] }).success, false);

console.log("✅ payment-reconciliation: parsing, suggestions, confirmation and validation");
