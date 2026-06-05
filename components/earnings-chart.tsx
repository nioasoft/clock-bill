"use client";

import { useTranslations } from "next-intl";
import { HourglassSVG } from "@/components/ui/thematic-elements";

const MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

interface MonthlyEarnings {
  month: string;
  amount: number;
  formatted: string;
}

interface EarningsChartProps {
  /** Monthly earnings rows (from the dashboard stats call). */
  data: MonthlyEarnings[];
  /** Whether the parent is still loading the dashboard data. */
  loading?: boolean;
}

export function EarningsChart({ data, loading = false }: EarningsChartProps) {
  const t = useTranslations("Dashboard.earningsChart");
  const earningsData = data;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">{t("title")}</h3>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
        </div>
      </div>
    );
  }

  if (earningsData.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">{t("title")}</h3>
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <HourglassSVG size={64} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground text-center">
            {t("empty")}
          </p>
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...earningsData.map((d) => d.amount));

  // Format the localized month abbreviation from a "YYYY-MM" string.
  const formatMonthName = (monthStr: string) => {
    const [, month] = monthStr.split('-');
    const monthIndex = parseInt(month) - 1;
    const key = MONTH_KEYS[monthIndex];
    return key ? t(`months.${key}`) : "";
  };

  return (
    <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-foreground">{t("title")}</h3>
      <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
        {t("subtitle", { count: earningsData.length })}
      </p>

      {/* Vertical bars in plain flex — responsive and RTL-native, no fixed SVG
          width that strands a lone bar on one side. */}
      <div className="flex items-end gap-2 sm:gap-4">
        {earningsData.map((data) => {
          const pct = maxAmount > 0 ? (data.amount / maxAmount) * 100 : 0;
          return (
            <div key={data.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-semibold tabular-nums text-foreground">
                {data.formatted}
              </span>
              <div className="flex h-40 w-full max-w-[44px] items-end">
                <div
                  className="w-full rounded-t-md bg-primary transition-[height] duration-500 ease-out"
                  style={{ height: `${Math.max(pct, 3)}%` }}
                  role="img"
                  aria-label={`${formatMonthName(data.month)}: ${data.formatted}`}
                />
              </div>
              <span className="text-[11px] text-muted-foreground">{formatMonthName(data.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
