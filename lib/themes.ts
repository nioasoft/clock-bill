/** Single source of truth for the selectable theme set. Adding a theme = one CSS
 *  block in app/[locale]/themes.css + one entry here. Components never import this
 *  for styling — only the settings selector and the API validation do. */
export interface ThemeMeta {
  id: string;
  labelHe: string;
  labelEn: string;
  base: "dark" | "light";
  /** 3 representative hexes for the selector swatch [canvas, surface, accent]. */
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  { id: "dark", labelHe: "כהה", labelEn: "Dark", base: "dark", swatch: ["#0a0a0a", "#1a1a1a", "#faff69"] },
];

export const DEFAULT_THEME = "dark";

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}
