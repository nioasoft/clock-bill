/**
 * Resolves the language a generated document (PDF / charge doc / Excel) renders
 * in. The document language is a property of the CLIENT, not the freelancer's UI
 * locale. NULL setting = "Auto": inferred from the client's currency.
 */

export type DocumentLanguage = "he" | "en";

/** A client's stored document-language setting; null = "auto". */
export type ClientDocLanguage = DocumentLanguage | null;

export const DOCUMENT_LANGUAGES: readonly DocumentLanguage[] = ["he", "en"];

/**
 * @param setting client/document setting: "he" | "en" | null(=auto)
 * @param currency the client/document currency (e.g. "ILS", "USD")
 * @returns the concrete document locale
 */
export function resolveDocumentLocale(
  setting: ClientDocLanguage,
  currency: string
): DocumentLanguage {
  if (setting === "he" || setting === "en") return setting;
  return currency === "ILS" ? "he" : "en";
}
