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
  { id: "dark", labelHe: "חצות", labelEn: "Midnight", base: "dark", swatch: ["#0a0a0a", "#1a1a1a", "#faff69"] },
  { id: "daylight", labelHe: "אור יום", labelEn: "Daylight", base: "light", swatch: ["#f4f4f2", "#ffffff", "#d4a900"] },
  { id: "twilight", labelHe: "דמדומים", labelEn: "Twilight", base: "dark", swatch: ["#16140f", "#232019", "#fae15c"] },
  { id: "parchment", labelHe: "קלף", labelEn: "Parchment", base: "light", swatch: ["#f5f0e6", "#fffdf7", "#b45309"] },
  { id: "phosphor", labelHe: "זרחן", labelEn: "Phosphor", base: "dark", swatch: ["#07100b", "#0f1d16", "#3dfa7e"] },
  { id: "cobalt", labelHe: "קובלט", labelEn: "Cobalt", base: "dark", swatch: ["#070d1a", "#0e1828", "#4d9bff"] },
  { id: "pulse", labelHe: "פעימה", labelEn: "Pulse", base: "dark", swatch: ["#120610", "#1f0f1c", "#ff4d8d"] },
  { id: "ultraviolet", labelHe: "אולטרה", labelEn: "Ultraviolet", base: "light", swatch: ["#f4f3fb", "#ffffff", "#5b3df5"] },
  { id: "mist", labelHe: "ערפל", labelEn: "Mist", base: "light", swatch: ["#eef2f3", "#ffffff", "#0d7d8c"] },
  { id: "bloom", labelHe: "פריחה", labelEn: "Bloom", base: "light", swatch: ["#faf0f2", "#ffffff", "#be185d"] },
  { id: "sharp", labelHe: "חדות", labelEn: "Sharp", base: "light", swatch: ["#ffffff", "#0b0b0c", "#1d4ed8"] },
  { id: "obsidian", labelHe: "אובסידיאן", labelEn: "Obsidian", base: "dark", swatch: ["#000000", "#100e16", "#a78bfa"] },
];

export const DEFAULT_THEME = "dark";

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEMES.some((t) => t.id === value);
}
