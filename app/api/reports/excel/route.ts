import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
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

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

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
        p.pricing_model,
        p.hourly_rate,
        p.currency,
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
    const queryParams: any[] = [user.id];
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
      pricing_model: string;
      hourly_rate: number | null;
      currency: string;
      client_name: string;
      client_id: string;
      client_contact_name: string | null;
      client_email: string | null;
      client_phone: string | null;
      client_address: string | null;
    }>(queryText, queryParams);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "שעון - מערכת למעקב שעות";
    workbook.created = new Date();

    // Create main worksheet with entries
    const worksheet = workbook.addWorksheet("רשומות זמן");

    // Define columns
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

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE85D04" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center", rightToLeft: true };
    headerRow.height = 25;

    // Add data rows
    let totalMinutes = 0;
    let totalAmounts: Record<string, number> = {};

    result.rows.forEach((entry) => {
      const durationMinutes = entry.duration;
      const durationHours = durationMinutes / 60;
      const hourlyRate = entry.hourly_rate || 0;
      const amount = hourlyRate > 0 ? durationHours * hourlyRate : 0;
      const currency = entry.currency || "ILS";

      totalMinutes += durationMinutes;

      if (!totalAmounts[currency]) {
        totalAmounts[currency] = 0;
      }
      totalAmounts[currency] += amount;

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

    // Set right-to-left direction for all cells
    worksheet.eachRow((row) => {
      row.alignment = { rightToLeft: true };
    });

    // Add summary sheet
    const summarySheet = workbook.addWorksheet("סיכום");

    summarySheet.columns = [
      { header: "תיאור", key: "description", width: 30 },
      { header: "ערך", key: "value", width: 20 },
    ];

    // Style summary header
    const summaryHeaderRow = summarySheet.getRow(1);
    summaryHeaderRow.font = { bold: true, size: 12 };
    summaryHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4A5568" },
    };
    summaryHeaderRow.alignment = { vertical: "middle", horizontal: "center", rightToLeft: true };
    summaryHeaderRow.height = 25;

    // Add summary data
    summarySheet.addRow({ description: "סה״כ רשומות", value: result.rows.length });
    summarySheet.addRow({ description: "סה״כ שעות", value: (totalMinutes / 60).toFixed(2) });
    summarySheet.addRow({ description: "סה״כ דקות", value: totalMinutes });

    // Add totals by currency
    Object.entries(totalAmounts).forEach(([currency, amount]) => {
      summarySheet.addRow({
        description: `סה״כ סכום (${currency})`,
        value: amount.toFixed(2),
      });
    });

    // Add filter period if specified
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

    // Set right-to-left for summary sheet
    summarySheet.eachRow((row) => {
      row.alignment = { rightToLeft: true };
    });

    // Add client summary sheet
    const clientSummarySheet = workbook.addWorksheet("סיכום לפי לקוח");

    clientSummarySheet.columns = [
      { header: "לקוח", key: "clientName", width: 30 },
      { header: "סה״כ שעות", key: "totalHours", width: 15 },
      { header: "סה״כ רשומות", key: "totalEntries", width: 15 },
    ];

    // Style client summary header
    const clientHeaderRow = clientSummarySheet.getRow(1);
    clientHeaderRow.font = { bold: true, size: 12 };
    clientHeaderRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    clientHeaderRow.alignment = { vertical: "middle", horizontal: "center", rightToLeft: true };
    clientHeaderRow.height = 25;

    // Group by client
    const byClient: Record<string, { totalMinutes: number; entries: number }> = {};
    result.rows.forEach((entry) => {
      const key = entry.client_id;
      if (!byClient[key]) {
        byClient[key] = { totalMinutes: 0, entries: 0 };
      }
      byClient[key].totalMinutes += entry.duration;
      byClient[key].entries++;
    });

    Object.entries(byClient).forEach(([clientId, data]) => {
      const client = result.rows.find((r) => r.client_id === clientId);
      if (client) {
        clientSummarySheet.addRow({
          clientName: client.client_name,
          totalHours: (data.totalMinutes / 60).toFixed(2),
          totalEntries: data.entries,
        });
      }
    });

    clientSummarySheet.eachRow((row) => {
      row.alignment = { rightToLeft: true };
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Generate filename with date range
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `report_${dateStr}.xlsx`;

    // Return Excel file
    return new NextResponse(buffer as Buffer, {
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
