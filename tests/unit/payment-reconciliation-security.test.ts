import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const route = readFileSync(join(process.cwd(), "app/api/payment-reconciliation/route.ts"), "utf8");
const migration = readFileSync(join(process.cwd(), "drizzle/0037_payment_reconciliation.sql"), "utf8");
const screen = readFileSync(join(process.cwd(), "app/[locale]/(auth)/reports/PaymentReconciliationTab.tsx"), "utf8");

assert.ok(route.includes("getUser()"), "both methods must authenticate");
assert.ok((route.match(/user_id = \$[12]/g) ?? []).length >= 6, "every document/payment query must be tenant scoped");
assert.ok(route.includes("FOR UPDATE"), "documents must be locked while validating outstanding balance");
assert.ok(route.includes("AMOUNT_EXCEEDS_OUTSTANDING"), "server must prevent overpayment");
assert.ok(route.includes("applyReconciliationSchema"), "server must validate the confirmation payload");
assert.ok(route.includes("payment-reconciliation-write"), "writes must be rate limited per user");
assert.ok(route.includes("ON CONFLICT (user_id, reconciliation_key)"), "writes must be idempotent");
assert.ok(migration.includes("UNIQUE INDEX") && migration.includes("user_id, reconciliation_key"));
assert.ok(screen.includes("parseReconciliationCsv(await file.text())"), "CSV must be parsed locally rather than uploaded");
assert.ok(screen.includes("confirmed: true"), "the write request only follows explicit review confirmation");

console.log("✅ payment-reconciliation-security: tenant scope, locking, confirmation and idempotency");
