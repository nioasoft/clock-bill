import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges } from "@/lib/fixed-charges";
import { addMoney, calcHourlyAmount } from "@/lib/money";
import ExcelJS from "exceljs";

/**
 * GET /api/reports/excel
 * Generate Excel file based on report filters (date range, client, project)
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

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const includeFixedCharges = searchParams.get("includeFixedCharges") !== "0";

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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "מוניט - מערכת למעקב שעות";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("רשומות זמן");
    worksheet.columns = [
      { header: "תאריך", key: "date", width: 15 },
      { header: "לקוח", key: "clientName", width: 20 },
      { header: "פרויקט", key: "projectName", width: 20 },
      { header: "תיאור", key: "description", width: 40 },
      { header: "משך (דקות)", key: "durationMinutes", width: 15 },
      { header: "משך (שעות)", key: "durationHours", width: 15 },
      { header: "תעריף שעתי", key: "hourlyRate", width: 15 },
      { header: "מטבע", key: "currency", width: 10 },
      { header: "סכום", key: "amount", width: 15 },
      { header: "ניתן לחיוב", key: "isBillable", width: 12 },
      { header: "תגיות", key: "tags", width: 20 },
      { header: "הערות", key: "notes", width: 30 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE85D04" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl" };
    headerRow.height = 25;

    let totalMinutes = 0;
    const timeAmounts: Record<string, number> = {};

    result.rows.forEach((entry) => {
      const durationMinutes = entry.duration;
      const durationHours = durationMinutes / 60;
      const hourlyRate = entry.hourly_rate || 0;
      const amount = calcHourlyAmount(durationMinutes, entry.hourly_rate);
      const currency = entry.currency || "ILS";

      totalMinutes += durationMinutes;
      if (!timeAmounts[currency]) {
        timeAmounts[currency] = 0;
      }
      timeAmounts[currency] = addMoney(timeAmounts[currency], amount);

      worksheet.addRow({
        date: entry.date,
        clientName: entry.client_name,
        projectName: entry.project_name,
        description: entry.description,
        durationMinutes,
        durationHours: durationHours.toFixed(2),
        hourlyRate: hourlyRate || "",
        currency,
        amount: amount > 0 ? amount.toFixed(2) : "",
        isBillable: entry.is_billable ? "כן" : "לא",
        tags: Array.isArray(entry.tags) ? entry.tags.join(", ") : "",
        notes: entry.notes || "",
      });
    });

    worksheet.eachRow((row: ExcelJS.Row) => {
      row.alignment = { readingOrder: "rtl" };
    });

    let fixedCharges: ReturnType<typeof calculateFixedMonthlyCharges> = [];
    const fixedAmounts: Record<string, number> = {};

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

      fixedCharges.forEach((line) => {
        if (!fixedAmounts[line.currency]) {
          fixedAmounts[line.currency] = 0;
        }
        fixedAmounts[line.currency] = addMoney(fixedAmounts[line.currency], line.amount);
      });
    }

    if (fixedCharges.length > 0) {
      const fixedSheet = workbook.addWorksheet("חיובים קבועים");
      fixedSheet.columns = [
        { header: "חודש", key: "month", width: 15 },
        { header: "לקוח", key: "clientName", width: 20 },
        { header: "פרויקט", key: "projectName", width: 20 },
        { header: "סוג", key: "type", width: 18 },
        { header: "מטבע", key: "currency", width: 10 },
        { header: "סכום", key: "amount", width: 15 },
      ];

      const fixedHeader = fixedSheet.getRow(1);
      fixedHeader.font = { bold: true, size: 12 };
      fixedHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      fixedHeader.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl" };
      fixedHeader.height = 25;

      fixedCharges.forEach((line) => {
        fixedSheet.addRow({
          month: line.month,
          clientName: line.clientName,
          projectName: line.projectName,
          type: "חיוב קבוע חודשי",
          currency: line.currency,
          amount: line.amount.toFixed(2),
        });
      });

      fixedSheet.eachRow((row: ExcelJS.Row) => {
        row.alignment = { readingOrder: "rtl" };
      });
    }

    const summarySheet = workbook.addWorksheet("סיכום");
    summarySheet.columns = [
      { header: "תיאור", key: "description", width: 30 },
      { header: "ערך", key: "value", width: 20 },
    ];

    const summaryHeaderRow = summarySheet.getRow(1);
    summaryHeaderRow.font = { bold: true, size: 12 };
    summaryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4A5568" },
    };
    summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl" };
    summaryHeaderRow.height = 25;

    summarySheet.addRow({ description: "סה״כ רשומות", value: result.rows.length });
    summarySheet.addRow({ description: "סה״כ שעות", value: (totalMinutes / 60).toFixed(2) });
    summarySheet.addRow({ description: "סה״כ דקות", value: totalMinutes });

    Object.entries(timeAmounts).forEach(([currency, amount]) => {
      summarySheet.addRow({
        description: `סה״כ שעות (${currency})`,
        value: amount.toFixed(2),
      });
    });

    Object.entries(fixedAmounts).forEach(([currency, amount]) => {
      summarySheet.addRow({
        description: `סה״כ חיובים קבועים (${currency})`,
        value: amount.toFixed(2),
      });
    });

    const allCurrencies = new Set([...Object.keys(timeAmounts), ...Object.keys(fixedAmounts)]);
    allCurrencies.forEach((currency) => {
      const total = (timeAmounts[currency] || 0) + (fixedAmounts[currency] || 0);
      summarySheet.addRow({
        description: `סה״כ כולל (${currency})`,
        value: total.toFixed(2),
      });
    });

    if (startDate || endDate) {
      summarySheet.addRow({});
      summarySheet.addRow({ description: "תקופת הדוח", value: "" });
      if (startDate) {
        summarySheet.addRow({ description: "מתאריך", value: startDate });
      }
      if (endDate) {
        summarySheet.addRow({ description: "עד תאריך", value: endDate });
      }
    }

    summarySheet.eachRow((row: ExcelJS.Row) => {
      row.alignment = { readingOrder: "rtl" };
    });

    const clientSummarySheet = workbook.addWorksheet("סיכום לפי לקוח");
    clientSummarySheet.columns = [
      { header: "לקוח", key: "clientName", width: 30 },
      { header: "סה״כ שעות", key: "totalHours", width: 15 },
      { header: "סה״כ רשומות", key: "totalEntries", width: 15 },
    ];

    const clientHeaderRow = clientSummarySheet.getRow(1);
    clientHeaderRow.font = { bold: true, size: 12 };
    clientHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    clientHeaderRow.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl" };
    clientHeaderRow.height = 25;

    const byClient: Record<string, { totalMinutes: number; entries: number }> = {};
    result.rows.forEach((entry) => {
      const key = entry.client_id;
      if (!byClient[key]) {
        byClient[key] = { totalMinutes: 0, entries: 0 };
      }
      byClient[key].totalMinutes += entry.duration;
      byClient[key].entries++;
    });

    Object.entries(byClient).forEach(([clientIdKey, data]) => {
      const client = result.rows.find((r) => r.client_id === clientIdKey);
      if (client) {
        clientSummarySheet.addRow({
          clientName: client.client_name,
          totalHours: (data.totalMinutes / 60).toFixed(2),
          totalEntries: data.entries,
        });
      }
    });

    clientSummarySheet.eachRow((row: ExcelJS.Row) => {
      row.alignment = { readingOrder: "rtl" };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    let filename = "report";
    if (startDate && endDate) {
      filename = `report_${startDate}_to_${endDate}`;
    } else if (startDate) {
      filename = `report_from_${startDate}`;
    } else if (endDate) {
      filename = `report_until_${endDate}`;
    } else {
      const dateStr = new Date().toISOString().split("T")[0];
      filename = `report_${dateStr}`;
    }
    filename += ".xlsx";

    return new NextResponse(Buffer.from(buffer) as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error("Error generating Excel:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת קובץ Excel" },
      { status: 500 }
    );
  }
}
