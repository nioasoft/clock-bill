export interface FixedChargeProject {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  currency: string;
  fixedMonthlyFee: number;
  fixedMonthlyStartDate: string | null;
  fixedMonthlyEndDate: string | null;
}

export interface FixedChargeLine {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  month: string;
  amount: number;
  currency: string;
  type: "fixed_monthly";
}

function parseDateOrDefault(value: string | null, fallback: string): Date {
  return new Date(value || fallback);
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatMonth(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

/**
 * For each month touched by the selected range, add one full monthly charge
 * when the fixed charge was active for at least one day in that month range.
 */
export function calculateFixedMonthlyCharges(
  projects: FixedChargeProject[],
  rangeStartDate: string,
  rangeEndDate: string
): FixedChargeLine[] {
  const rangeStart = new Date(rangeStartDate);
  const rangeEnd = new Date(rangeEndDate);

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
    return [];
  }

  const lines: FixedChargeLine[] = [];
  const startMonth = firstDayOfMonth(rangeStart);
  const endMonth = firstDayOfMonth(rangeEnd);

  for (const project of projects) {
    if (!(project.fixedMonthlyFee > 0)) continue;

    const activeStart = parseDateOrDefault(project.fixedMonthlyStartDate, "1900-01-01");
    const activeEnd = parseDateOrDefault(project.fixedMonthlyEndDate, "2999-12-31");

    for (let cursor = new Date(startMonth); cursor <= endMonth; cursor.setMonth(cursor.getMonth() + 1)) {
      const monthStart = firstDayOfMonth(cursor);
      const monthEnd = lastDayOfMonth(cursor);

      const effectiveStart = new Date(Math.max(
        monthStart.getTime(),
        rangeStart.getTime(),
        activeStart.getTime()
      ));
      const effectiveEnd = new Date(Math.min(
        monthEnd.getTime(),
        rangeEnd.getTime(),
        activeEnd.getTime()
      ));

      if (effectiveStart <= effectiveEnd) {
        lines.push({
          projectId: project.projectId,
          projectName: project.projectName,
          clientId: project.clientId,
          clientName: project.clientName,
          month: formatMonth(monthStart),
          amount: project.fixedMonthlyFee,
          currency: project.currency || "ILS",
          type: "fixed_monthly",
        });
      }
    }
  }

  return lines;
}
