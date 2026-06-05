export const BRAND = {
  name: "מוניט",
  nameEn: "Monit",
  tagline: "הזמן שלך שווה כסף",
  description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית",
} as const;

/**
 * Brand theme color for browser chrome / PWA (`themeColor`, native status bar).
 * Mirrors the `--color-background` design token (#0a0a0a) defined in
 * `app/globals.css`. Viewport/metadata exports can't read CSS variables, so this
 * constant is the sanctioned single source — keep it in sync with the token.
 */
export const THEME_COLOR = "#0a0a0a" as const;
