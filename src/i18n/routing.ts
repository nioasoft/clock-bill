import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  // Hebrew (default) stays prefix-less: /dashboard. English gets /en/dashboard.
  localePrefix: "as-needed",
  // Persist the chosen locale so a returning visitor keeps it.
  localeCookie: { name: "NEXT_LOCALE" },
});

export type Locale = (typeof routing.locales)[number];
