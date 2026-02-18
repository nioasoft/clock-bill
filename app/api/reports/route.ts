import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges } from "@/lib/fixed-charges";

/**
 * GET /api/reports
 * Generate report data based on filters (date range, client, project)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");

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
        p.name as project_name,
        c.default_rate as hourly_rate,
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

    queryText += ` ORDER BY te.date DESC, te.created_at DESC`;

    const result = await query<{
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
      project_name: string;
      hourly_rate: number | null;
      currency: string;
      client_name: string;
      client_id: string;
      client_contact_name: string | null;
      client_email: string | null;
      client_phone: string | null;
      client_address: string | null;
    }>(queryText, queryParams);

    const entries = result.rows.map((entry) => {
      const amount = entry.hourly_rate
        ? (entry.duration / 60) * entry.hourly_rate
        : 0;

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
        date: entry.date,
        tags: entry.tags || [],
        notes: entry.notes,
        isBillable: entry.is_billable,
        pricingModel: "hourly",
        hourlyRate: entry.hourly_rate,
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
      acc[currency] += entry.amount || 0;
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
      acc[key].totalAmounts[currency] += entry.amount || 0;

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
      acc[key].totalAmount += entry.amount || 0;
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
      acc[key].totalAmounts[currency] += entry.amount || 0;

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
      acc[weekKey].totalAmounts[currency] += entry.amount || 0;

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

    let fixedCharges: ReturnType<typeof calculateFixedMonthlyCharges> = [];
    const fixedAmountsByCurrency: Record<string, number> = {};

    if (includeFixedCharges && startDate && endDate) {
      let fixedProjectsQuery = `
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
      const fixedProjectsParams: (string | number | boolean | null)[] = [user.id];
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

      const fixedProjects = await query<{
        project_id: string;
        project_name: string;
        client_id: string;
        client_name: string;
        currency: string;
        fixed_monthly_fee: number;
        fixed_monthly_start_date: string | null;
        fixed_monthly_end_date: string | null;
      }>(fixedProjectsQuery, fixedProjectsParams);

      fixedCharges = calculateFixedMonthlyCharges(
        fixedProjects.rows.map((p) => ({
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
        fixedAmountsByCurrency[line.currency] += line.amount;

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
        byClient[line.clientId].totalAmounts[line.currency] += line.amount;

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
        byProject[line.projectId].totalAmount += line.amount;
      }
    }

    const totalAmountsByCurrency = { ...timeAmountsByCurrency };
    for (const [currency, amount] of Object.entries(fixedAmountsByCurrency)) {
      if (!totalAmountsByCurrency[currency]) {
        totalAmountsByCurrency[currency] = 0;
      }
      totalAmountsByCurrency[currency] += amount;
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
        byDate: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
        byWeek: Object.values(byWeek).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
      },
    }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60"
      }
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הדוח" },
      { status: 500 }
    );
  }
}
