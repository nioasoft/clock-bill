import type { JSX } from "react";
import { CURRENCY_SYMBOLS } from "@/lib/currency";

const NUMBER_FORMATTERS = {
  he: new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
} as const;

interface MarketingAmountProps {
  amount: number;
  locale: string;
  className?: string;
}

/**
 * Marketing examples intentionally follow the page locale: ILS in Hebrew and
 * USD in English. We place the symbol explicitly so every example has the same
 * visual order, then isolate the rendered amount from the surrounding RTL UI.
 */
export function formatMarketingAmount(amount: number, locale: string): string {
  const isHebrew = locale === "he";
  const number = NUMBER_FORMATTERS[isHebrew ? "he" : "en"].format(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";

  return isHebrew
    ? `${sign}${number}\u00a0${CURRENCY_SYMBOLS.ILS}`
    : `${sign}${CURRENCY_SYMBOLS.USD}${number}`;
}

export function MarketingAmount({ amount, locale, className }: MarketingAmountProps): JSX.Element {
  const classes = ["font-mono", "tabular-nums", className].filter(Boolean).join(" ");

  return (
    <bdi dir="ltr" data-marketing-amount className={classes}>
      {formatMarketingAmount(amount, locale)}
    </bdi>
  );
}
