import { readFileSync } from "node:fs";
import { join } from "node:path";
import { localePrefixFromPath } from "../../lib/locale-path";

if (localePrefixFromPath("/en/settings") !== "en") throw new Error("English prefix not detected");
if (localePrefixFromPath("/he/dashboard") !== "he") throw new Error("Hebrew prefix not detected");
if (localePrefixFromPath("/settings") !== null) throw new Error("prefix-less route must stay unresolved");

const source = readFileSync(join(process.cwd(), "components/app-layout.tsx"), "utf8");
if (!source.includes("if (explicitLocale)")) throw new Error("AppLayout does not protect explicit locale deep links");
if (!source.includes("setLocaleCookie(explicitLocale)")) throw new Error("explicit locale is not persisted");
// A fresh explicit switch (cookie == active locale) must beat the stale cached profile.
if (!source.includes("NEXT_LOCALE=([^;]+)/)?.[1] === locale) return;")) throw new Error("profile sync can revert a fresh locale switch");
console.log("✅ authed-locale-deeplink: explicit locale remains authoritative");

// next-intl's middleware cookie sync stamped an in-flight /en prefetch's locale
// back onto NEXT_LOCALE, reverting an en→he switch. We own the cookie.
const routingSource = readFileSync(join(process.cwd(), "src/i18n/routing.ts"), "utf8");
if (!routingSource.includes("localeCookie: false")) throw new Error("next-intl must not manage NEXT_LOCALE");
console.log("✅ authed-locale-deeplink: next-intl cookie sync disabled");
