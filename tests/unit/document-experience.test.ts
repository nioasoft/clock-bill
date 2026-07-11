import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function run(): void {
  const documents = source("app", "[locale]", "(auth)", "reports", "DocumentsTab.tsx");
  const documentView = source("app", "[locale]", "(auth)", "reports", "ChargeDocumentView.tsx");
  const payments = source("app", "[locale]", "(auth)", "reports", "ChargePaymentsPanel.tsx");
  const statusMeta = source("app", "[locale]", "(auth)", "reports", "statusMeta.ts");
  const publicPage = source("app", "[locale]", "doc", "[token]", "page.tsx");
  const publicDocument = source("app", "[locale]", "doc", "[token]", "PublicChargeDocument.tsx");
  const combined = [documents, documentView, payments, statusMeta, publicDocument].join("\n");

  assert(!combined.includes("transition-all"), "Document surfaces must transition explicit properties only");
  assert(
    !documents.includes("border-s-2") && statusMeta.includes("surface:") && statusMeta.includes("dot:"),
    "Document status must use text, surface, and dot treatments instead of a directional stripe"
  );
  assert(
    documentView.includes('lifecycleStatuses: ChargeDocStatus[] = ["pending", "partial", "paid"]') &&
      documentView.includes('aria-current={current ? "step" : undefined}'),
    "The document view must expose the payment lifecycle as an accessible step sequence"
  );
  assert(
    payments.includes('components/ui/input') &&
      payments.includes('components/ui/label') &&
      payments.includes('components/ui/simple-select'),
    "Payment entry must use shared labeled controls"
  );
  assert(
    publicDocument.includes('<h1 id="public-document-title"') &&
      publicDocument.includes('<article aria-labelledby="public-document-title"') &&
      publicDocument.includes("outstandingAmount"),
    "The public document must identify itself and expose its payment status"
  );
  assert(
    publicPage.includes("isValidPublicToken(token)") &&
      publicPage.includes("d.public_token_expires_at > NOW()") &&
      publicPage.includes("d.status <> 'canceled'"),
    "Public document UI changes must preserve token validation, expiry, and canceled-document denial"
  );

  console.log("✅ document-experience: lifecycle, controls, public trust, and token guards pass");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ document-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
