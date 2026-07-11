import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(): void {
  const clientsApi = source("app/api/clients/route.ts");
  const clientsPage = source("app/[locale]/clients/page.tsx");
  const clientPage = source("app/[locale]/clients/[id]/page.tsx");

  assert(
    clientsApi.includes("settlementBillingDay: z.number().int().min(1).max(31).nullish()"),
    "Client creation must validate the settlement billing day"
  );
  assert(
    clientsApi.includes("settlement_billing_day") &&
      clientsApi.includes("settlementBillingDay: client.settlement_billing_day ?? null"),
    "Client creation and list responses must persist and expose the settlement billing day"
  );
  assert(
    clientsPage.includes("projectId: r.projectId ?? null") &&
      clientPage.includes("projectId: r.projectId ?? null"),
    "Both client edit mappers must preserve project-scoped rates"
  );
  assert(
    clientsPage.includes("ratesLoading") && clientsPage.includes("ratesLoadError"),
    "List editing must expose loading and error states while rates are unresolved"
  );
  assert(
    clientsPage.includes("disabled={submitting || ratesLoading") &&
      clientsPage.includes("if (isEditing && ratesLoading) return"),
    "Saving an existing client must be blocked until its rates are loaded"
  );

  console.log("✅ client-data-integrity: settlement and scoped rates are protected");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error(
    "❌ client-data-integrity:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
