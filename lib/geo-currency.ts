/**
 * Pure mapping from an ISO 3166-1 alpha-2 country code (e.g. Vercel's
 * `x-vercel-ip-country` header) to a suggested currency for onboarding.
 * Suggestion only — the user always confirms it. Falls back to ILS.
 */
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
]);

export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return "ILS";
  const c = country.toUpperCase();
  if (c === "IL") return "ILS";
  if (c === "US") return "USD";
  if (EU_COUNTRIES.has(c)) return "EUR";
  return "ILS";
}
