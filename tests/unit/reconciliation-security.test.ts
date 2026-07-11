import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "app", "api", "reconciliation", "today", "route.ts"), "utf8");
const failures: string[] = [];
function check(condition: boolean, message: string) { if (!condition) failures.push(message); }

check(source.includes("getUser()"), "route must authenticate");
check((source.match(/user_id = \$1/g) ?? []).length >= 4, "every reconciliation query must scope rows by user id");
check(source.includes("[user.id, localDate]"), "date-scoped queries must bind the authenticated user and local date");
check(source.includes("LIMIT 5"), "gap details must be bounded");
check(!source.includes("SELECT *"), "route must select only required fields");

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`❌ ${failure}`));
  process.exit(1);
}
console.log("✅ reconciliation-security: authenticated, tenant-scoped, and bounded");
