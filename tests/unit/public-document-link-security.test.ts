import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const sendRoute = readFileSync(
  join(root, "app", "api", "charge-documents", "[id]", "send", "route.ts"),
  "utf8"
);
const cancelRoute = readFileSync(
  join(root, "app", "api", "charge-documents", "[id]", "cancel", "route.ts"),
  "utf8"
);
const publicPage = readFileSync(
  join(root, "app", "[locale]", "doc", "[token]", "page.tsx"),
  "utf8"
);
const migration = readFileSync(
  join(root, "drizzle", "0035_public_document_link_expiry.sql"),
  "utf8"
);

const checks: Array<[string, boolean]> = [
  [
    "every send rotates the bearer token and persists an expiry",
    sendRoute.includes("const token = generatePublicToken()") &&
      sendRoute.includes("public_token_expires_at = $2"),
  ],
  [
    "send responses never expose the raw bearer token",
    !sendRoute.includes("sentAt, token"),
  ],
  [
    "authenticated owners can revoke a public link",
    sendRoute.includes("export async function DELETE") &&
      sendRoute.includes("public_token = NULL") &&
      sendRoute.includes("public_token_expires_at = NULL") &&
      sendRoute.includes("user_id = $2"),
  ],
  [
    "public reads reject expired links",
    publicPage.includes("d.public_token_expires_at > NOW()"),
  ],
  [
    "canceling a document revokes its public link",
    cancelRoute.includes("public_token = NULL") &&
      cancelRoute.includes("public_token_expires_at = NULL"),
  ],
  [
    "migration expires legacy tokens and enforces token-expiry pairing",
    migration.includes("ADD COLUMN IF NOT EXISTS public_token_expires_at") &&
      migration.includes("INTERVAL '30 days'") &&
      migration.includes("charge_documents_public_link_pair_check"),
  ],
];

let failed = 0;
for (const [name, passed] of checks) {
  if (passed) {
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${name}`);
  }
}

assert(failed === 0, `${failed} public document link security check(s) failed`);
