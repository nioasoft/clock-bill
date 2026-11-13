import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["he", "en"],
  defaultLocale: "he",
  // Hebrew (default) stays prefix-less: /dashboard. English gets /en/dashboard.
  localePrefix: "as-needed",
  // NEXT_LOCALE is owned by our code (proxy.ts geo stamp, lib/locale-preference,
  // AppLayout deep links). next-intl's own sync rewrites it to the URL's locale on
  // EVERY response — an /en prefetch still in flight after switching to Hebrew
  // stamped "en" back and reverted the switch.
  localeCookie: false,
  // Disable next-intl's Accept-Language and cookie detection. Our proxy applies
  // a valid NEXT_LOCALE preference first, then uses geo for first-time visits;
  // an explicit URL prefix stays authoritative in both cases.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
