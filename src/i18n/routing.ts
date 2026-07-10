import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  // Hebrew (default) stays prefix-less: /dashboard. English gets /en/dashboard.
  localePrefix: "as-needed",
  // Persist the chosen locale so a returning visitor keeps it.
  localeCookie: { name: "NEXT_LOCALE" },
  // Disable next-intl's Accept-Language and cookie detection. Our proxy applies
  // a valid NEXT_LOCALE preference first, then uses geo for first-time visits;
  // an explicit URL prefix stays authoritative in both cases.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
