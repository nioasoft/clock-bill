/**
 * Resolve an app locale ("he"/"en") or a full BCP-47 tag to a concrete
 * Intl locale. Hebrew renders with he-IL conventions, English with en-US.
 */
export function resolveIntlLocale(locale: string): string {
  if (locale === "he" || locale === "he-IL") return "he-IL";
  if (locale === "en" || locale === "en-US") return "en-US";
  // Already a full tag (or unknown) — pass through, falling back to he-IL.
  return locale.includes("-") ? locale : "he-IL";
}
