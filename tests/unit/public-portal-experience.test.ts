import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPublicDocumentHistory } from "../../lib/public-charge-document";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

function run(): void {
  const history = buildPublicDocumentHistory({
    issuedAt: "2026-07-01T08:00:00.000Z",
    lastSentAt: "2026-07-02T09:00:00.000Z",
    payments: [
      { amount: 250, paidAt: "2026-07-04", method: "bank_transfer" },
      { amount: 100, paidAt: "2026-07-03", method: null },
    ],
  });

  assert(history.length === 4, "History must include issue, send, and every payment event");
  assert(history[0]?.type === "payment" && history[0]?.amount === 250, "History must be newest first");

  const approvedHistory = buildPublicDocumentHistory({
    issuedAt: "2026-07-01T08:00:00.000Z",
    lastSentAt: "2026-07-02T09:00:00.000Z",
    payments: [],
    approvedAt: "2026-07-03T10:00:00.000Z",
    approvedBy: "client",
  });
  assert(approvedHistory.length === 3, "History must include the approval event");
  assert(
    approvedHistory[0]?.type === "approved" && approvedHistory[0]?.by === "client",
    "Approval event must be newest first and carry who approved"
  );
  const ownerApproved = buildPublicDocumentHistory({
    issuedAt: "2026-07-01T08:00:00.000Z",
    lastSentAt: null,
    payments: [],
    approvedAt: "2026-07-03T10:00:00.000Z",
    approvedBy: "owner",
  });
  assert(ownerApproved[0]?.by === "owner", "Owner approval must keep by='owner'");
  assert(
    Object.keys(history[0] ?? {}).every((key) => !["id", "token", "email", "note"].includes(key)),
    "Client history must not expose internal IDs, tokens, recipient addresses, or payment notes"
  );

  const page = source("app", "[locale]", "doc", "[token]", "page.tsx");
  const portal = source("app", "[locale]", "doc", "[token]", "PublicChargeDocument.tsx");
  const he = JSON.parse(source("messages", "he.json")) as Record<string, unknown>;
  const en = JSON.parse(source("messages", "en.json")) as Record<string, unknown>;

  assert(
    page.includes("isValidPublicToken(token)") &&
      page.includes("d.public_token_expires_at > NOW()") &&
      page.includes("d.status <> 'canceled'"),
    "Portal reads must preserve token validation, expiry, and cancel guards"
  );
  assert(
    page.includes("WHERE document_id = $1 AND user_id = $2") &&
      !page.includes("sent_to_email") &&
      !page.includes("SELECT amount, paid_at::text AS paid_at, method, note"),
    "Portal history must stay document-and-owner scoped and omit sensitive fields"
  );
  assert(
    page.includes('referrer: "no-referrer"') && page.includes('dynamic = "force-dynamic"'),
    "Bearer-link pages must disable referrer leakage and static caching"
  );
  assert(
    portal.includes('useTranslations("Portal")') &&
      portal.includes('role="progressbar"') &&
      portal.includes("handlePrint") &&
      portal.includes("history.map"),
    "Portal must expose localized status, payment progress, print/save, and history"
  );
  assert(he.Portal && en.Portal, "Both locales must provide the dedicated Portal namespace");
  // The bearer token must never cross the Server Component boundary as a prop —
  // the client reads it from the URL (useParams) for the approve action.
  assert(!page.includes("token={"), "page.tsx must not pass the bearer token as a component prop");
  assert(portal.includes("useParams"), "The portal must read the token from the URL, not from props");
  assert(
    portal.includes("/approve") && portal.includes("approveConfirming"),
    "The portal must expose a confirm-gated client approve action"
  );

  console.log("✅ public-portal-experience: secure read-only portal UX passes");
}

try {
  run();
  process.exit(0);
} catch (error) {
  console.error("❌ public-portal-experience:", error instanceof Error ? error.message : error);
  process.exit(1);
}
