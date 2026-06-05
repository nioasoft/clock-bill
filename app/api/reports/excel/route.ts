import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { calculateFixedMonthlyCharges } from "@/lib/fixed-charges";
import { addMoney, calcHourlyAmount, calcItemAmount } from "@/lib/money";
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
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
    const locale = searchParams.get("locale") === "en" ? "en" : "he";

    // Inline bilingual labels (server-side, intentionally NOT in the message catalog).
    const L =
      locale === "en"
        ? {
            creator: "Monit - Time Tracking System",
            sheetEntries: "Time Entries",
            sheetFixed: "Fixed Charges",
            sheetSummary: "Summary",
            sheetByClient: "Summary by Client",
            sheetByLabel: "Breakdown by Label",
            colDate: "Date",
            colClient: "Client",
            colProject: "Project",
            colKind: "Type",
            colRateLabel: "Label",
            colDescription: "Description",
            colDurationMinutes: "Duration (min)",
            colDurationHours: "Duration (hours)",
            colQuantity: "Quantity",
            colRate: "Rate",
            colCurrency: "Currency",
            colAmount: "Amount",
            colIsBillable: "Billable",
            colTags: "Tags",
            colNotes: "Notes",
            colMonth: "Month",
            colSummaryDescription: "Description",
            colSummaryValue: "Value",
            colTotalHours: "Total Hours",
            colTotalEntries: "Total Entries",
            colMeasure: "Hours / Quantity",
            kindItem: "Item",
            kindHourly: "Hours",
            yes: "Yes",
            no: "No",
            fixedMonthlyType: "Fixed Monthly Charge",
            totalEntries: "Total Entries",
            totalHours: "Total Hours",
            totalMinutes: "Total Minutes",
            totalHoursByCurrency: (c: string) => `Total Hours (${c})`,
            totalFixedByCurrency: (c: string) => `Total Fixed Charges (${c})`,
            grandTotalByCurrency: (c: string) => `Grand Total (${c})`,
            reportPeriod: "Report Period",
            fromDate: "From Date",
            toDate: "To Date",
            units: "units",
            emptyLabel: "—",
            readingOrder: "ltr" as const,
          }
        : {
            creator: "מוניט - מערכת למעקב שעות",
            sheetEntries: "רשומות זמן",
            sheetFixed: "חיובים קבועים",
            sheetSummary: "סיכום",
            sheetByClient: "סיכום לפי לקוח",
            sheetByLabel: "פירוט לפי תווית",
            colDate: "תאריך",
            colClient: "לקוח",
            colProject: "פרויקט",
            colKind: "סוג",
            colRateLabel: "תווית",
            colDescription: "תיאור",
            colDurationMinutes: "משך (דקות)",
            colDurationHours: "משך (שעות)",
            colQuantity: "כמות",
            colRate: "תעריף",
            colCurrency: "מטבע",
            colAmount: "סכום",
            colIsBillable: "ניתן לחיוב",
            colTags: "תגיות",
            colNotes: "הערות",
            colMonth: "חודש",
            colSummaryDescription: "תיאור",
            colSummaryValue: "ערך",
            colTotalHours: "סה״כ שעות",
            colTotalEntries: "סה״כ רשומות",
            colMeasure: "שעות / כמות",
            kindItem: "פריט",
            kindHourly: "שעות",
            yes: "כן",
            no: "לא",
            fixedMonthlyType: "חיוב קבוע חודשי",
            totalEntries: "סה״כ רשומות",
            totalHours: "סה״כ שעות",
            totalMinutes: "סה״כ דקות",
            totalHoursByCurrency: (c: string) => `סה״כ שעות (${c})`,
            totalFixedByCurrency: (c: string) => `סה״כ חיובים קבועים (${c})`,
            grandTotalByCurrency: (c: string) => `סה״כ כולל (${c})`,
            reportPeriod: "תקופת הדוח",
            fromDate: "מתאריך",
            toDate: "עד תאריך",
            units: "יח׳",
            emptyLabel: "—",
            readingOrder: "rtl" as const,
          };

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
      billing_kind: string | null;
      rate: number | null;
      rate_label: string | null;
      quantity: number | null;
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
    workbook.creator = L.creator;
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(L.sheetEntries);
    worksheet.columns = [
      { header: L.colDate, key: "date", width: 15 },
      { header: L.colClient, key: "clientName", width: 20 },
      { header: L.colProject, key: "projectName", width: 20 },
      { header: L.colKind, key: "kind", width: 10 },
      { header: L.colRateLabel, key: "rateLabel", width: 18 },
      { header: L.colDescription, key: "description", width: 40 },
      { header: L.colDurationMinutes, key: "durationMinutes", width: 15 },
      { header: L.colDurationHours, key: "durationHours", width: 15 },
      { header: L.colQuantity, key: "quantity", width: 10 },
      { header: L.colRate, key: "hourlyRate", width: 15 },
      { header: L.colCurrency, key: "currency", width: 10 },
      { header: L.colAmount, key: "amount", width: 15 },
      { header: L.colIsBillable, key: "isBillable", width: 12 },
      { header: L.colTags, key: "tags", width: 20 },
      { header: L.colNotes, key: "notes", width: 30 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE85D04" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center", readingOrder: L.readingOrder };
    headerRow.height = 25;

    let totalMinutes = 0;
    const timeAmounts: Record<string, number> = {};

    result.rows.forEach((entry) => {
      const isItem = entry.billing_kind === "item";
      const durationMinutes = entry.duration;
      const durationHours = durationMinutes / 60;
      const effectiveRate = entry.rate ?? entry.hourly_rate;
      const amount = isItem
        ? calcItemAmount(entry.quantity, entry.rate)
        : calcHourlyAmount(durationMinutes, effectiveRate);
      const currency = entry.currency || "ILS";

      totalMinutes += isItem ? 0 : durationMinutes;
      if (!timeAmounts[currency]) {
        timeAmounts[currency] = 0;
      }
      timeAmounts[currency] = addMoney(timeAmounts[currency], amount);

      worksheet.addRow({
        date: entry.date,
        clientName: entry.client_name,
        projectName: entry.project_name,
        kind: isItem ? L.kindItem : L.kindHourly,
        rateLabel: entry.rate_label || "",
        description: entry.description,
        durationMinutes: isItem ? "" : durationMinutes,
        durationHours: isItem ? "" : durationHours.toFixed(2),
        quantity: isItem ? (entry.quantity ?? "") : "",
        hourlyRate: effectiveRate || "",
        currency,
        amount: amount > 0 ? amount.toFixed(2) : "",
        isBillable: entry.is_billable ? L.yes : L.no,
        tags: Array.isArray(entry.tags) ? entry.tags.join(", ") : "",
        notes: entry.notes || "",
      });
    });

    worksheet.eachRow((row: ExcelJS.Row) => {
      row.alignment = { readingOrder: L.readingOrder };
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
      const fixedSheet = workbook.addWorksheet(L.sheetFixed);
      fixedSheet.columns = [
        { header: L.colMonth, key: "month", width: 15 },
        { header: L.colClient, key: "clientName", width: 20 },
        { header: L.colProject, key: "projectName", width: 20 },
        { header: L.colKind, key: "type", width: 18 },
        { header: L.colCurrency, key: "currency", width: 10 },
        { header: L.colAmount, key: "amount", width: 15 },
      ];

      const fixedHeader = fixedSheet.getRow(1);
      fixedHeader.font = { bold: true, size: 12 };
      fixedHeader.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF2563EB" },
      };
      fixedHeader.alignment = { vertical: "middle", horizontal: "center", readingOrder: L.readingOrder };
      fixedHeader.height = 25;

      fixedCharges.forEach((line) => {
        fixedSheet.addRow({
          month: line.month,
          clientName: line.clientName,
          projectName: line.projectName,
          type: L.fixedMonthlyType,
          currency: line.currency,
          amount: line.amount.toFixed(2),
        });
      });

      fixedSheet.eachRow((row: ExcelJS.Row) => {
        row.alignment = { readingOrder: L.readingOrder };
      });
    }

    const summarySheet = workbook.addWorksheet(L.sheetSummary);
    summarySheet.columns = [
      { header: L.colSummaryDescription, key: "description", width: 30 },
      { header: L.colSummaryValue, key: "value", width: 20 },
    ];

    const summaryHeaderRow = summarySheet.getRow(1);
    summaryHeaderRow.font = { bold: true, size: 12 };
    summaryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4A5568" },
    };
    summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center", readingOrder: L.readingOrder };
    summaryHeaderRow.height = 25;

    summarySheet.addRow({ description: L.totalEntries, value: result.rows.length });
    summarySheet.addRow({ description: L.totalHours, value: (totalMinutes / 60).toFixed(2) });
    summarySheet.addRow({ description: L.totalMinutes, value: totalMinutes });

    Object.entries(timeAmounts).forEach(([currency, amount]) => {
      summarySheet.addRow({
        description: L.totalHoursByCurrency(currency),
        value: amount.toFixed(2),
      });
    });

    Object.entries(fixedAmounts).forEach(([currency, amount]) => {
      summarySheet.addRow({
        description: L.totalFixedByCurrency(currency),
        value: amount.toFixed(2),
      });
    });

    const allCurrencies = new Set([...Object.keys(timeAmounts), ...Object.keys(fixedAmounts)]);
    allCurrencies.forEach((currency) => {
      const total = (timeAmounts[currency] || 0) + (fixedAmounts[currency] || 0);
      summarySheet.addRow({
        description: L.grandTotalByCurrency(currency),
        value: total.toFixed(2),
      });
    });

    if (startDate || endDate) {
      summarySheet.addRow({});
      summarySheet.addRow({ description: L.reportPeriod, value: "" });
      if (startDate) {
        summarySheet.addRow({ description: L.fromDate, value: startDate });
      }
      if (endDate) {
        summarySheet.addRow({ description: L.toDate, value: endDate });
      }
    }

    summarySheet.eachRow((row: ExcelJS.Row) => {
      row.alignment = { readingOrder: L.readingOrder };
    });

    const clientSummarySheet = workbook.addWorksheet(L.sheetByClient);
    clientSummarySheet.columns = [
      { header: L.colClient, key: "clientName", width: 30 },
      { header: L.colTotalHours, key: "totalHours", width: 15 },
      { header: L.colTotalEntries, key: "totalEntries", width: 15 },
    ];

    const clientHeaderRow = clientSummarySheet.getRow(1);
    clientHeaderRow.font = { bold: true, size: 12 };
    clientHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    clientHeaderRow.alignment = { vertical: "middle", horizontal: "center", readingOrder: L.readingOrder };
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
      row.alignment = { readingOrder: L.readingOrder };
    });

    // Breakdown by rate/item label ("פירוט לפי תווית").
    const byLabel: Record<string, {
      label: string; kind: string; currency: string;
      totalMinutes: number; totalQuantity: number; totalAmount: number;
    }> = {};
    result.rows.forEach((entry) => {
      const isItem = entry.billing_kind === "item";
      const label = entry.rate_label || L.emptyLabel;
      const currency = entry.currency || "ILS";
      const key = `${label}|${currency}`;
      const effectiveRate = entry.rate ?? entry.hourly_rate;
      const amount = isItem
        ? calcItemAmount(entry.quantity, entry.rate)
        : calcHourlyAmount(entry.duration, effectiveRate);
      if (!byLabel[key]) {
        byLabel[key] = { label, kind: isItem ? "item" : "hourly", currency, totalMinutes: 0, totalQuantity: 0, totalAmount: 0 };
      }
      if (isItem) byLabel[key].totalQuantity += entry.quantity || 0;
      else byLabel[key].totalMinutes += entry.duration;
      byLabel[key].totalAmount = addMoney(byLabel[key].totalAmount, amount);
    });

    if (Object.keys(byLabel).length > 0) {
      const labelSheet = workbook.addWorksheet(L.sheetByLabel);
      labelSheet.columns = [
        { header: L.colRateLabel, key: "label", width: 25 },
        { header: L.colKind, key: "kind", width: 10 },
        { header: L.colMeasure, key: "measure", width: 15 },
        { header: L.colCurrency, key: "currency", width: 10 },
        { header: L.colAmount, key: "amount", width: 15 },
      ];
      const labelHeader = labelSheet.getRow(1);
      labelHeader.font = { bold: true, size: 12 };
      labelHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE85D04" } };
      labelHeader.alignment = { vertical: "middle", horizontal: "center", readingOrder: L.readingOrder };
      labelHeader.height = 25;
      Object.values(byLabel).forEach((l) => {
        labelSheet.addRow({
          label: l.label,
          kind: l.kind === "item" ? L.kindItem : L.kindHourly,
          measure: l.kind === "item" ? `${l.totalQuantity} ${L.units}` : (l.totalMinutes / 60).toFixed(2),
          currency: l.currency,
          amount: l.totalAmount.toFixed(2),
        });
      });
      labelSheet.eachRow((row: ExcelJS.Row) => {
        row.alignment = { readingOrder: L.readingOrder };
      });
    }

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
      { success: false, error_code: "EXCEL_GENERATION_ERROR", message: "שגיאה ביצירת קובץ Excel" },
      { status: 500 }
    );
  }
}
