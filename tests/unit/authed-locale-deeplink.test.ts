import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localePrefixFromPath } from "../../lib/locale-path";

if (localePrefixFromPath("/en/settings") !== "en") throw new Error("English prefix not detected");
if (localePrefixFromPath("/he/dashboard") !== "he") throw new Error("Hebrew prefix not detected");
if (localePrefixFromPath("/settings") !== null) throw new Error("prefix-less route must stay unresolved");

const source = readFileSync(join(process.cwd(), "components/app-layout.tsx"), "utf8");
if (!source.includes("if (explicitLocale)")) throw new Error("AppLayout does not protect explicit locale deep links");
if (!source.includes("NEXT_LOCALE=${explicitLocale}")) throw new Error("explicit locale is not persisted");
console.log("✅ authed-locale-deeplink: explicit locale remains authoritative");
