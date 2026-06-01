"use client";

import { HourglassSVG } from "@/components/ui/thematic-elements";

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
  const earningsData = data;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">הכנסות חודשיות</h3>
        <div className="h-48 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (earningsData.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">הכנסות חודשיות</h3>
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <HourglassSVG size={64} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground text-center">
            התחל לעקוב אחרי הזמן שלך כדי לראות הכנסות
          </p>
        </div>
      </div>
    );
  }

  const maxAmount = Math.max(...earningsData.map((d) => d.amount));

  // Format Hebrew month name
  const formatMonthName = (monthStr: string) => {
    const [, month] = monthStr.split('-');
    const monthNames = [
      'ינו׳', 'פבר׳', 'מרץ', 'אפר׳',
      'מאי', 'יונ׳', 'יול׳', 'אוג׳',
      'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'
    ];
    const monthIndex = parseInt(month) - 1;
    return monthNames[monthIndex];
  };

  return (
    <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-foreground">הכנסות חודשיות</h3>
      <p className="mt-0.5 mb-5 text-xs text-muted-foreground">
        סך ההכנסות לחיוב ב-{earningsData.length} החודשים האחרונים
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
