/** Currency symbols + formatting shared across the app. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  USDT: "₮",
  BTC: "₿",
  ETH: "Ξ",
};

/** Crypto currencies have no ISO 4217 code, so Intl can't style them. */
const CRYPTO_FRACTION_DIGITS: Record<string, number> = {
  USDT: 2,
  BTC: 8,
  ETH: 6,
};

/** App locale ("he"/"en") or BCP-47 tag → concrete Intl locale. */
function resolveIntlLocale(locale: string): string {
  if (locale === "he" || locale === "he-IL") return "he-IL";
  if (locale === "en" || locale === "en-US") return "en-US";
  return locale.includes("-") ? locale : "he-IL";
}

/**
 * Format a monetary amount for the active locale.
 *
 * Fiat (ILS, USD) goes through `Intl.NumberFormat({ style: "currency" })`,
 * which adds thousands separators and places the symbol per locale. Crypto
 * (USDT/BTC/ETH) has no ISO code, so the number is grouped via Intl and the
 * symbol from {@link CURRENCY_SYMBOLS} is prepended.
 *
 * @param amount - The numeric amount
 * @param currency - Currency code (ILS, USD, USDT, BTC, ETH)
 * @param locale - App locale ("he"/"en") or BCP-47 tag (default: "he")
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = "he"
): string {
  const intlLocale = resolveIntlLocale(locale);
  const cryptoDigits = CRYPTO_FRACTION_DIGITS[currency];

  // Crypto: group the number, then prepend the glyph (no ISO support in Intl).
  if (cryptoDigits !== undefined) {
    const formattedNumber = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: cryptoDigits,
    }).format(amount);
    return `${CURRENCY_SYMBOLS[currency]}${formattedNumber}`;
  }

  // Fiat with an ISO code: let Intl place the symbol + separators.
  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    // Unknown / unsupported ISO code — fall back to symbol + grouped number.
    const formattedNumber = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${CURRENCY_SYMBOLS[currency] || currency}${formattedNumber}`;
  }
}
