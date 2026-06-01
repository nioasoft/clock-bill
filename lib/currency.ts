/** Currency symbols + formatting shared across settlement tabs. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  ILS: "₪",
  USD: "$",
  USDT: "₮",
  BTC: "₿",
  ETH: "Ξ",
};

/** Same currency display helper used across the reports screen. */
export function formatCurrency(amount: number, currency: string): string {
  return `${CURRENCY_SYMBOLS[currency] || currency}${amount.toFixed(2)}`;
}
