"use client";

import { useEffect, useState } from "react";
import { HourglassSVG } from "@/components/ui/thematic-elements";

interface MonthlyEarnings {
  month: string;
  amount: number;
  formatted: string;
}

export function EarningsChart() {
  const [earningsData, setEarningsData] = useState<MonthlyEarnings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEarningsData = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/dashboard/earnings-chart");
        const data = await response.json();

        if (data.success) {
          setEarningsData(data.monthlyEarnings || []);
        } else {
          setError(data.message || "שגיאה בטעינת הנתונים");
        }
      } catch (err) {
        console.error("Error fetching earnings chart data:", err);
        setError("שגיאה בטעינת הנתונים");
      } finally {
        setLoading(false);
      }
    };

    fetchEarningsData();
  }, []);

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

  if (error || earningsData.length === 0) {
    return (
      <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">הכנסות חודשיות</h3>
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <HourglassSVG size={64} className="text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground text-center">
            {error || "התחל לעקוב אחרי הזמן שלך כדי לראות הכנסות"}
          </p>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions
  const maxAmount = Math.max(...earningsData.map(d => d.amount));
  const chartHeight = 150;
  const barWidth = 40;
  const gap = 20;
  const chartWidth = earningsData.length * (barWidth + gap) - gap;

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
      <h3 className="font-display text-lg font-semibold text-foreground mb-4">הכנסות חודשיות</h3>

      <div className="h-48 overflow-x-auto">
        <svg
          width={Math.max(chartWidth, 400)}
          height={chartHeight + 40}
          className="mx-auto"
          role="img"
          aria-label="תרשים הכנסות"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = chartHeight - (chartHeight * fraction);
            return (
              <line
                key={`grid-${fraction}`}
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                className="stroke-border opacity-50"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Bars */}
          {earningsData.map((data, index) => {
            const barHeight = (data.amount / maxAmount) * chartHeight;
            const x = index * (barWidth + gap);
            const y = chartHeight - barHeight;

            return (
              <g key={data.month} className="group cursor-pointer">
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="currentColor"
                  className="text-primary group-hover:opacity-80 transition-opacity"
                  rx={6}
                />

                {/* Amount label on top of bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-foreground text-xs font-medium"
                >
                  {data.formatted}
                </text>

                {/* Month label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-muted-foreground text-xs"
                >
                  {formatMonthName(data.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Y-axis labels */}
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>0</span>
        <span>₪{(maxAmount / 4).toFixed(0)}</span>
        <span>₪{(maxAmount / 2).toFixed(0)}</span>
        <span>₪{(maxAmount * 0.75).toFixed(0)}</span>
        <span>₪{maxAmount.toFixed(0)}</span>
      </div>
    </div>
  );
}
