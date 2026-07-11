import { readFileSync } from "node:fs";
import { join } from "node:path";

const api = readFileSync(
  join(process.cwd(), "app/api/clients/[id]/workspace/route.ts"),
  "utf8"
);
const workspace = readFileSync(
  join(process.cwd(), "components/clients/client-workspace.tsx"),
  "utf8"
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(api.includes("c.id = $2 AND c.user_id = $1"), "client lookup must be owner scoped");
assert(api.includes("te.user_id = $1") && api.includes("p.user_id = $1"), "work queries must be owner scoped");
assert(api.includes("d.user_id = $1") && api.includes("pay.user_id = $1"), "document and payment queries must be owner scoped");
assert(api.includes("summarizeClientMoney"), "workspace money must reuse the audited money summary");
assert(api.includes('"Cache-Control": "no-store, must-revalidate"'), "private workspace data must not be cached");
assert(workspace.includes("<h1") && workspace.includes('role="tablist"'), "workspace needs one page title and semantic tabs");
assert(workspace.includes("dataError") && workspace.includes("WorkspaceError"), "workspace must distinguish errors from empty data");
assert(workspace.includes("formatCurrency") && workspace.includes("<bdi>"), "money must use locale formatting and bidi isolation");
assert(!workspace.includes('<a href="/projects'), "localized navigation must use the i18n Link component");

console.log("✅ client-workspace-api: ownership and money source guardrails pass");
