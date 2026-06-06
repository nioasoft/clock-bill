import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  // Hebrew (default) stays prefix-less: /dashboard. English gets /en/dashboard.
  localePrefix: "as-needed",
  // Persist the chosen locale so a returning visitor keeps it.
  localeCookie: { name: "NEXT_LOCALE" },
  // Disable next-intl's Accept-Language auto-detection. Our geo logic in
  // `proxy.ts` is the authoritative source for a first-time visitor's default
  // locale (Israel -> Hebrew, elsewhere -> English); explicit prefix and the
  // NEXT_LOCALE cookie still win over geo.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
