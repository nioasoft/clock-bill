import { createLogger } from "@/lib/logger";
const logger = createLogger("api:reports");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { calculateFixedMonthlyCharges } from "@/lib/fixed-charges";
import { addMoney, calcHourlyAmount, calcItemAmount } from "@/lib/money";
import { resolveRounding, roundBillableMinutes } from "@/lib/rounding";

/**
 * GET /api/reports
 * Generate report data based on filters (date range, client, project)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const limited = await enforceRateLimit({ name: "reports", identifier: user.id, limit: 20, windowSec: 60 });
    if (limited) return limited;

    const { withTransaction } = await import("@/lib/db");

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const includeFixedCharges = searchParams.get("includeFixedCharges") !== "0";

    // Build query with filters
    let queryText = `
      SELECT
        te.id,
        te.project_id,
        te.description,
        te.start_time,
        te.end_time,
        te.duration,
        te.date,
        te.tags,
        te.notes,
        te.is_billable,
        te.created_at,
        te.billing_kind,
        te.rate,
        te.rate_label,
        te.quantity,
        te.item_ref,
        te.unit,
        p.name as project_name,
        p.billing_rounding as project_rounding,
        c.default_rate as hourly_rate,
        c.billing_rounding as client_rounding,
        c.currency,
        c.name as client_name,
        c.id as client_id,
        c.contact_name as client_contact_name,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address
      FROM time_entries te
      JOIN projects p ON te.project_id = p.id
      JOIN clients c ON p.client_id = c.id
      WHERE te.user_id = $1
    `;
    const queryParams: (string | number | boolean | null)[] = [user.id];
    let paramIndex = 2;

    if (clientId) {
      queryText += ` AND c.id = $${paramIndex}`;
      queryParams.push(clientId);
      paramIndex++;
    }

    if (projectId) {
      queryText += ` AND p.id = $${paramIndex}`;
      queryParams.push(projectId);
      paramIndex++;
    }

    if (startDate) {
      queryText += ` AND te.date >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND te.date <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    // Hard cap so an account with years of data can't fetch + aggregate an
    // unbounded result set in memory on every request.
    queryText += ` ORDER BY te.date DESC, te.created_at DESC LIMIT 50000`;

    // Build the (optional) fixed-monthly-projects query up front so the profile
    // base, the entries query, and the fixed-projects query all run inside ONE
    // transaction (one RLS bind / round-trip set) instead of three serial ones.
    const includeFixed = Boolean(includeFixedCharges && startDate && endDate);
    let fixedProjectsQuery = "";
    let fixedProjectsParams: (string | number | boolean | null)[] = [];
    if (includeFixed) {
      fixedProjectsQuery = `
        SELECT
          p.id as project_id,
          p.name as project_name,
          c.id as client_id,
          c.name as client_name,
          c.currency,
          p.fixed_monthly_fee,
          p.fixed_monthly_start_date,
          p.fixed_monthly_end_date
        FROM projects p
        JOIN clients c ON p.client_id = c.id
        WHERE p.user_id = $1
          AND p.fixed_monthly_enabled = TRUE
          AND COALESCE(p.fixed_monthly_fee, 0) > 0
      `;
      fixedProjectsParams = [user.id];
      let fixedParamIndex = 2;
      if (clientId) {
        fixedProjectsQuery += ` AND c.id = $${fixedParamIndex}`;
        fixedProjectsParams.push(clientId);
        fixedParamIndex++;
      }
      if (projectId) {
        fixedProjectsQuery += ` AND p.id = $${fixedParamIndex}`;
        fixedProjectsParams.push(projectId);
        fixedParamIndex++;
      }
    }

    type FixedProjectRow = {
      project_id: string;
      project_name: string;
      client_id: string;
      client_name: string;
      currency: string;
      fixed_monthly_fee: number;
      fixed_monthly_start_date: string | null;
      fixed_monthly_end_date: string | null;
    };

    // Profile-level billing base (cascade's lowest tier: project > client >
    // profile > 'none'), entries, and fixed projects — one transaction.
    const { profileRow, entryRows, fixedRows } = await withTransaction(async (client) => {
      const profile = await client.query<{ default_billing_rounding: string | null; default_rate: number | null }>(
        `SELECT default_billing_rounding, default_rate FROM user_profiles WHERE user_id = $1`,
        [user.id]
      );
      const entriesRes = await client.query<{
        id: string;
        project_id: string;
        description: string;
        start_time: string | null;
        end_time: string | null;
        duration: number;
        date: string;
        tags: unknown;
        notes: string | null;
        is_billable: boolean;
        created_at: string;
        billing_kind: string | null;
        rate: number | null;
        rate_label: string | null;
        quantity: number | null;
        item_ref: number | null;
        unit: string | null;
        project_name: string;
        project_rounding: string | null;
        hourly_rate: number | null;
        client_rounding: string | null;
        currency: string;
        client_name: string;
        client_id: string;
        client_contact_name: string | null;
        client_email: string | null;
        client_phone: string | null;
        client_address: string | null;
      }>(queryText, queryParams);
      const fixedRes = includeFixed
        ? await client.query<FixedProjectRow>(fixedProjectsQuery, fixedProjectsParams)
        : { rows: [] as FixedProjectRow[] };
      return { profileRow: profile.rows[0], entryRows: entriesRes.rows, fixedRows: fixedRes.rows };
    });

    const baseRounding = profileRow?.default_billing_rounding ?? null;
    const baseRate = profileRow?.default_rate ?? null;

    const entries = entryRows.map((entry) => {
      const isItem = entry.billing_kind === "item";
      // Hourly lines fall back to the client default_rate when no snapshot rate.
      const effectiveRate = entry.rate ?? entry.hourly_rate ?? baseRate;
      // Hourly time is billed on rounded minutes per the client/project policy;
      // raw `duration` stays the worked time used for hours aggregates below.
      const roundingMode = resolveRounding(entry.project_rounding, entry.client_rounding, baseRounding);
      const billedMinutes = isItem
        ? entry.duration
        : roundBillableMinutes(entry.duration, roundingMode);
      const amount = isItem
        ? calcItemAmount(entry.quantity, entry.rate)
        : calcHourlyAmount(billedMinutes, effectiveRate);

      return {
        id: entry.id,
        projectId: entry.project_id,
        projectName: entry.project_name,
        clientId: entry.client_id,
        clientName: entry.client_name,
        clientContactName: entry.client_contact_name,
        clientEmail: entry.client_email,
        clientPhone: entry.client_phone,
        clientAddress: entry.client_address,
        description: entry.description,
        startTime: entry.start_time,
        endTime: entry.end_time,
        duration: entry.duration,
        billedMinutes,
        date: entry.date,
        tags: entry.tags || [],
        notes: entry.notes,
        isBillable: entry.is_billable,
        pricingModel: isItem ? "item" : "hourly",
        billingKind: isItem ? "item" : "hourly",
        hourlyRate: effectiveRate,
        rateLabel: entry.rate_label,
        quantity: entry.quantity,
        itemRef: entry.item_ref,
        unit: entry.unit,
        currency: entry.currency,
        amount,
        createdAt: entry.created_at,
      };
    });

    const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const totalHours = totalMinutes / 60;

    const timeAmountsByCurrency = entries.reduce((acc, entry) => {
      const currency = entry.currency || "ILS";
      if (!acc[currency]) {
        acc[currency] = 0;
      }
      acc[currency] = addMoney(acc[currency], entry.amount || 0);
      return acc;
    }, {} as Record<string, number>);

    const byClient = entries.reduce((acc, entry) => {
      const key = entry.clientId;
      if (!acc[key]) {
        acc[key] = {
          clientId: entry.clientId,
          clientName: entry.clientName,
          clientContactName: entry.clientContactName,
          clientEmail: entry.clientEmail,
          clientPhone: entry.clientPhone,
          clientAddress: entry.clientAddress,
          totalMinutes: 0,
          totalHours: 0,
          totalAmounts: {} as Record<string, number>,
          entries: [],
        };
      }
      acc[key].totalMinutes += entry.duration;
      acc[key].totalHours = acc[key].totalMinutes / 60;

      const currency = entry.currency || "ILS";
      if (!acc[key].totalAmounts[currency]) {
        acc[key].totalAmounts[currency] = 0;
      }
      acc[key].totalAmounts[currency] = addMoney(acc[key].totalAmounts[currency], entry.amount || 0);

      acc[key].entries.push(entry);
      return acc;
    }, {} as Record<string, {
      clientId: string;
      clientName: string;
      clientContactName: string | null;
      clientEmail: string | null;
      clientPhone: string | null;
      clientAddress: string | null;
      totalMinutes: number;
      totalHours: number;
      totalAmounts: Record<string, number>;
      entries: typeof entries;
    }>);

    const byProject = entries.reduce((acc, entry) => {
      const key = entry.projectId;
      if (!acc[key]) {
        acc[key] = {
          projectId: entry.projectId,
          projectName: entry.projectName,
          clientId: entry.clientId,
          clientName: entry.clientName,
          pricingModel: "hourly",
          hourlyRate: entry.hourlyRate,
          currency: entry.currency,
          totalMinutes: 0,
          totalHours: 0,
          totalAmount: 0,
          entries: [],
        };
      }
      acc[key].totalMinutes += entry.duration;
      acc[key].totalHours = acc[key].totalMinutes / 60;
      acc[key].totalAmount = addMoney(acc[key].totalAmount, entry.amount || 0);
      acc[key].entries.push(entry);
      return acc;
    }, {} as Record<string, {
      projectId: string;
      projectName: string;
      clientId: string;
      clientName: string;
      pricingModel: string;
      hourlyRate: number | null;
      currency: string;
      totalMinutes: number;
      totalHours: number;
      totalAmount: number;
      entries: typeof entries;
    }>);

    const byDate = entries.reduce((acc, entry) => {
      const key = entry.date;
      if (!acc[key]) {
        acc[key] = {
          date: entry.date,
          totalMinutes: 0,
          totalHours: 0,
          totalAmounts: {} as Record<string, number>,
          entryCount: 0,
          entries: [],
        };
      }
      acc[key].totalMinutes += entry.duration;
      acc[key].totalHours = acc[key].totalMinutes / 60;
      acc[key].entryCount += 1;

      const currency = entry.currency || "ILS";
      if (!acc[key].totalAmounts[currency]) {
        acc[key].totalAmounts[currency] = 0;
      }
      acc[key].totalAmounts[currency] = addMoney(acc[key].totalAmounts[currency], entry.amount || 0);

      acc[key].entries.push(entry);
      return acc;
    }, {} as Record<string, {
      date: string;
      totalMinutes: number;
      totalHours: number;
      totalAmounts: Record<string, number>;
      entryCount: number;
      entries: typeof entries;
    }>);

    const byWeek = entries.reduce((acc, entry) => {
      const entryDate = new Date(entry.date);
      const weekStart = new Date(entryDate);
      weekStart.setDate(entryDate.getDate() - entryDate.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!acc[weekKey]) {
        acc[weekKey] = {
          weekStart: weekKey,
          weekEnd: new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          totalMinutes: 0,
          totalHours: 0,
          totalAmounts: {} as Record<string, number>,
          entryCount: 0,
          entries: [],
        };
      }
      acc[weekKey].totalMinutes += entry.duration;
      acc[weekKey].totalHours = acc[weekKey].totalMinutes / 60;
      acc[weekKey].entryCount += 1;

      const currency = entry.currency || "ILS";
      if (!acc[weekKey].totalAmounts[currency]) {
        acc[weekKey].totalAmounts[currency] = 0;
      }
      acc[weekKey].totalAmounts[currency] = addMoney(acc[weekKey].totalAmounts[currency], entry.amount || 0);

      acc[weekKey].entries.push(entry);
      return acc;
    }, {} as Record<string, {
      weekStart: string;
      weekEnd: string;
      totalMinutes: number;
      totalHours: number;
      totalAmounts: Record<string, number>;
      entryCount: number;
      entries: typeof entries;
    }>);

    // Breakdown by rate/item label (for the report's "פירוט לפי תווית" section).
    const byRateLabel = entries.reduce((acc, entry) => {
      const label = entry.rateLabel || "—";
      const currency = entry.currency || "ILS";
      const key = `${label}|${currency}`;
      if (!acc[key]) {
        acc[key] = {
          label,
          kind: entry.billingKind,
          currency,
          totalMinutes: 0,
          totalQuantity: 0,
          totalAmount: 0,
          entryCount: 0,
        };
      }
      acc[key].entryCount += 1;
      if (entry.billingKind === "item") {
        acc[key].totalQuantity += entry.quantity || 0;
      } else {
        acc[key].totalMinutes += entry.duration;
      }
      acc[key].totalAmount = addMoney(acc[key].totalAmount, entry.amount || 0);
      return acc;
    }, {} as Record<string, {
      label: string;
      kind: string;
      currency: string;
      totalMinutes: number;
      totalQuantity: number;
      totalAmount: number;
      entryCount: number;
    }>);

    let fixedCharges: ReturnType<typeof calculateFixedMonthlyCharges> = [];
    const fixedAmountsByCurrency: Record<string, number> = {};

    if (includeFixed && startDate && endDate) {
      fixedCharges = calculateFixedMonthlyCharges(
        fixedRows.map((p) => ({
          projectId: p.project_id,
          projectName: p.project_name,
          clientId: p.client_id,
          clientName: p.client_name,
          currency: p.currency || "ILS",
          fixedMonthlyFee: p.fixed_monthly_fee,
          fixedMonthlyStartDate: p.fixed_monthly_start_date,
          fixedMonthlyEndDate: p.fixed_monthly_end_date,
        })),
        startDate,
        endDate
      );

      for (const line of fixedCharges) {
        if (!fixedAmountsByCurrency[line.currency]) {
          fixedAmountsByCurrency[line.currency] = 0;
        }
        fixedAmountsByCurrency[line.currency] = addMoney(fixedAmountsByCurrency[line.currency], line.amount);

        if (!byClient[line.clientId]) {
          byClient[line.clientId] = {
            clientId: line.clientId,
            clientName: line.clientName,
            clientContactName: null,
            clientEmail: null,
            clientPhone: null,
            clientAddress: null,
            totalMinutes: 0,
            totalHours: 0,
            totalAmounts: {},
            entries: [],
          };
        }
        if (!byClient[line.clientId].totalAmounts[line.currency]) {
          byClient[line.clientId].totalAmounts[line.currency] = 0;
        }
        byClient[line.clientId].totalAmounts[line.currency] = addMoney(
          byClient[line.clientId].totalAmounts[line.currency],
          line.amount
        );

        if (!byProject[line.projectId]) {
          byProject[line.projectId] = {
            projectId: line.projectId,
            projectName: line.projectName,
            clientId: line.clientId,
            clientName: line.clientName,
            pricingModel: "fixed_monthly",
            hourlyRate: null,
            currency: line.currency,
            totalMinutes: 0,
            totalHours: 0,
            totalAmount: 0,
            entries: [],
          };
        }
        byProject[line.projectId].totalAmount = addMoney(byProject[line.projectId].totalAmount, line.amount);
      }
    }

    const totalAmountsByCurrency = { ...timeAmountsByCurrency };
    for (const [currency, amount] of Object.entries(fixedAmountsByCurrency)) {
      if (!totalAmountsByCurrency[currency]) {
        totalAmountsByCurrency[currency] = 0;
      }
      totalAmountsByCurrency[currency] = addMoney(totalAmountsByCurrency[currency], amount);
    }

    return NextResponse.json({
      success: true,
      report: {
        entries,
        fixedCharges,
        summary: {
          totalMinutes,
          totalHours,
          totalEntries: entries.length,
          fixedAmounts: fixedAmountsByCurrency,
          totalAmounts: totalAmountsByCurrency,
        },
        byClient: Object.values(byClient),
        byProject: Object.values(byProject),
        // `entry.date` is a pg DATE → a JS Date object server-side (it only
        // looks like a string after JSON serialization), so localeCompare threw.
        // Sort by timestamp — chronological and robust whether date is a Date,
        // an ISO string, or "YYYY-MM-DD".
        byDate: Object.values(byDate).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        ),
        byWeek: Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
        byRateLabel: Object.values(byRateLabel),
      },
    }, {
      headers: {
        "Cache-Control": "no-store, must-revalidate"
      }
    });
  } catch (error) {
    logger.error("Error generating report:", error);
    return NextResponse.json(
      { success: false, error_code: "REPORT_GENERATION_ERROR", message: "שגיאה ביצירת הדוח" },
      { status: 500 }
    );
  }
}
