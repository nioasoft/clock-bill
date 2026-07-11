import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "components/global-search.tsx"), "utf8");
for (const route of ["/entries?new=manual", "/entries?new=item", "/tasks?create=true", "/clients?create=true", "/reports"]) {
  if (!source.includes(route)) throw new Error(`missing command action ${route}`);
}
if (!source.includes("setShowTimerModal(true)")) throw new Error("timer action missing");
if (!source.includes("min-h-11")) throw new Error("command targets are too small");
console.log("✅ global-search-actions: safe navigation commands pass");
