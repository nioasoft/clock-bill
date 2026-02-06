import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
        c.id as client_id
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
    }>(queryText, queryParams);

    // Group entries by client and project for summary
    const entries = result.rows.map((entry) => ({
      id: entry.id,
      projectId: entry.project_id,
      projectName: entry.project_name,
      clientId: entry.client_id,
      clientName: entry.client_name,
      description: entry.description,
      startTime: entry.start_time,
      endTime: entry.end_time,
      duration: entry.duration,
      date: entry.date,
      tags: entry.tags || [],
      notes: entry.notes,
      isBillable: entry.is_billable,
      pricingModel: entry.pricing_model,
      hourlyRate: entry.hourly_rate,
      currency: entry.currency,
      createdAt: entry.created_at,
    }));

    // Calculate summaries
    const totalMinutes = entries.reduce((sum, entry) => sum + entry.duration, 0);
    const totalHours = totalMinutes / 60;

    // Group by client
    const byClient = entries.reduce((acc, entry) => {
      const key = entry.clientId;
      if (!acc[key]) {
        acc[key] = {
          clientId: entry.clientId,
          clientName: entry.clientName,
          totalMinutes: 0,
          totalHours: 0,
          entries: [],
        };
      }
      acc[key].totalMinutes += entry.duration;
      acc[key].totalHours = acc[key].totalMinutes / 60;
      acc[key].entries.push(entry);
      return acc;
    }, {} as Record<string, any>);

    // Group by project
    const byProject = entries.reduce((acc, entry) => {
      const key = entry.projectId;
      if (!acc[key]) {
        acc[key] = {
          projectId: entry.projectId,
          projectName: entry.projectName,
          clientId: entry.clientId,
          clientName: entry.clientName,
          pricingModel: entry.pricingModel,
          hourlyRate: entry.hourlyRate,
          currency: entry.currency,
          totalMinutes: 0,
          totalHours: 0,
          entries: [],
        };
      }
      acc[key].totalMinutes += entry.duration;
      acc[key].totalHours = acc[key].totalMinutes / 60;
      acc[key].entries.push(entry);
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      report: {
        entries,
        summary: {
          totalMinutes,
          totalHours,
          totalEntries: entries.length,
        },
        byClient: Object.values(byClient),
        byProject: Object.values(byProject),
      },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הדוח" },
      { status: 500 }
    );
  }
}
