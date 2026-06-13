export const BRAND = {
  name: "ClockBill",
  nameEn: "ClockBill",
  tagline: "הזמן שלך שווה כסף",
  description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית",
} as const;

/**
 * Locale-aware brand name. "ClockBill" is a single Latin word-mark used in every
 * locale (including the Hebrew RTL UI) — there is no transliteration. The helper
 * is kept for back-compat with existing callers and in case a locale ever needs
 * a script-specific variant again.
 *
 * @param locale The active next-intl locale (e.g. "he" | "en").
 * @returns The brand name.
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
