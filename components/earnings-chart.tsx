"use client";

import { useEffect, useState } from "react";

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
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">הכנסות חודשיות</h3>
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">טוען נתונים...</div>
        </div>
      </div>
    );
  }

  if (error || earningsData.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">הכנסות חודשיות</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">{error || "אין נתוני הכנסות זמינים"}</p>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions
  const maxAmount = Math.max(...earningsData.map(d => d.amount));
  const chartHeight = 200;
  const barWidth = 40;
  const gap = 20;
  const chartWidth = earningsData.length * (barWidth + gap) - gap;

  // Format Hebrew month name
  const formatMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const monthNames = [
      'ינו׳', 'פבר׳', 'מרץ', 'אפר׳',
      'מאי', 'יונ׳', 'יול׳', 'אוג׳',
      'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'
    ];
    const monthIndex = parseInt(month) - 1;
    return monthNames[monthIndex];
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">הכנסות חודשיות</h3>

      <div className="h-64 overflow-x-auto">
        <svg
          width={Math.max(chartWidth, 400)}
          height={chartHeight + 40}
          className="mx-auto"
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
                stroke="#e5e7eb"
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
              <g key={data.month}>
                {/* Bar */}
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="currentColor"
                  className="text-orange-500 hover:text-orange-600 transition-colors"
                  rx={4}
                />

                {/* Amount label on top of bar */}
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="fill-gray-700 text-xs font-medium"
                >
                  {data.formatted}
                </text>

                {/* Month label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-gray-600 text-xs"
                >
                  {formatMonthName(data.month)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Y-axis labels */}
      <div className="flex justify-between text-xs text-gray-500 mt-2">
        <span>0</span>
        <span>₪{(maxAmount / 4).toFixed(0)}</span>
        <span>₪{(maxAmount / 2).toFixed(0)}</span>
        <span>₪{(maxAmount * 0.75).toFixed(0)}</span>
        <span>₪{maxAmount.toFixed(0)}</span>
      </div>
    </div>
  );
}
