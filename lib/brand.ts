export const BRAND = {
  name: "מוניט",
  nameEn: "Monit",
  tagline: "הזמן שלך שווה כסף",
  description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית",
} as const;

/**
 * Locale-aware brand name. The logo/word-mark must read in the active UI
 * language: Hebrew "מוניט" for `he`, Latin "Monit" for `en` (and any other
 * non-`he` locale). Use this everywhere the brand name is *rendered* — never
 * the raw `BRAND.name`, which is Hebrew-only.
 *
 * @param locale The active next-intl locale (e.g. "he" | "en").
 * @returns The brand name in the matching script.
 */
export function brandName(locale: string): string {
  return locale === "en" ? BRAND.nameEn : BRAND.name;
}

/**
 * Brand theme color for browser chrome / PWA (`themeColor`, native status bar).
 * Mirrors the `--color-background` design token (#0a0a0a) defined in
 * `app/globals.css`. Viewport/metadata exports can't read CSS variables, so this
 * constant is the sanctioned single source — keep it in sync with the token.
 */
export const THEME_COLOR = "#0a0a0a" as const;
