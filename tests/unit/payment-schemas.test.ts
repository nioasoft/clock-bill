import { createPaymentSchema, patchChargeDocumentSchema } from "../../lib/schemas/charge-documents";

let passed = 0, failed = 0;
function assert(name: string, cond: boolean): void {
  if (cond) passed++; else { failed++; console.error(`  ✗ ${name}`); }
}

assert("valid payment", createPaymentSchema.safeParse({ amount: 600, paidAt: "2026-06-21", method: "bit" }).success);
assert("amount must be > 0", !createPaymentSchema.safeParse({ amount: 0, paidAt: "2026-06-21" }).success);
assert("bad method rejected", !createPaymentSchema.safeParse({ amount: 5, paidAt: "2026-06-21", method: "paypal" }).success);
assert("bad date rejected", !createPaymentSchema.safeParse({ amount: 5, paidAt: "21/06/2026" }).success);
assert("method optional", createPaymentSchema.safeParse({ amount: 5, paidAt: "2026-06-21" }).success);

assert("discount percent ok", patchChargeDocumentSchema.safeParse({ discount: { type: "percent", value: 10 } }).success);
assert("discount percent > 100 rejected", !patchChargeDocumentSchema.safeParse({ discount: { type: "percent", value: 150 } }).success);
assert("discount amount ok", patchChargeDocumentSchema.safeParse({ discount: { type: "amount", value: 150 } }).success);
assert("discount null clears", patchChargeDocumentSchema.safeParse({ discount: null }).success);
assert("negative discount rejected", !patchChargeDocumentSchema.safeParse({ discount: { type: "amount", value: -5 } }).success);

console.log(`\npayment-schemas: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
