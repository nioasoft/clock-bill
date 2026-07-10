import { readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const authSource = readFileSync(join(process.cwd(), "lib", "auth.ts"), "utf8");
const adminSource = readFileSync(join(process.cwd(), "lib", "admin.ts"), "utf8");
const actionsSource = readFileSync(
  join(process.cwd(), "app", "api", "admin", "users", "[id]", "actions", "route.ts"),
  "utf8"
);

const toggleRoleSource = actionsSource.match(
  /case "toggle_role": \{([\s\S]*?)\n\s*case "delete_user":/
)?.[1] ?? "";

const checks: Array<[string, boolean]> = [
  [
    "admin guards request a fresh database-backed session",
    adminSource.includes("getFreshUser()") && authSource.includes("disableCookieCache: true"),
  ],
  [
    "role changes and session revocation are one transaction",
    toggleRoleSource.includes("withTransaction") &&
      toggleRoleSource.includes('DELETE FROM "session" WHERE user_id = $1'),
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

assert(failed === 0, `${failed} admin session security check(s) failed`);
