import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET /api/projects/[id]
 * Get a single project by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: projectId } = await params;

    // Get project and verify ownership
    const result = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      default_rate: number | null;
      currency: string | null;
      status: string;
      start_date: string | null;
      end_date: string | null;
      fixed_monthly_enabled: boolean;
      fixed_monthly_fee: number | null;
      fixed_monthly_start_date: string | null;
      fixed_monthly_end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              c.default_rate, c.currency,
              p.status, p.start_date, p.end_date,
              p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
              p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1 AND p.user_id = $2`,
      [projectId, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const project = result.rows[0];

    // Calculate total hours and amount from time entries
    const statsResult = await query<{
      total_duration: number;
    }>(
      `SELECT COALESCE(SUM(duration), 0) as total_duration
       FROM time_entries
       WHERE project_id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    const totalDuration = statsResult.rows[0].total_duration || 0;
    const totalHours = totalDuration / 60;

    // Billing is determined by client rate
    const totalAmount = totalHours * (project.default_rate || 0);

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        clientName: project.client_name,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        fixedMonthlyEnabled: project.fixed_monthly_enabled,
        fixedMonthlyFee: project.fixed_monthly_fee,
        fixedMonthlyStartDate: project.fixed_monthly_start_date,
        fixedMonthlyEndDate: project.fixed_monthly_end_date,
        notes: project.notes,
        createdAt: project.created_at,
        totalHours,
        totalAmount,
        currency: project.currency || "ILS",
      },
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הפרויקט" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id]
 * Update an existing project
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      status,
      startDate,
      endDate,
      fixedMonthlyEnabled,
      fixedMonthlyFee,
      fixedMonthlyStartDate,
      fixedMonthlyEndDate,
      notes,
    } = body;
    const { id: projectId } = await params;

    if (status && !["active", "completed", "paused", "archived"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "סטטוס לא חוקי" },
        { status: 400 }
      );
    }

    const { query } = await import("@/lib/db");

    // Verify project exists and belongs to user
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2) as exists`,
      [projectId, user.id]
    );

    if (!checkResult.rows[0].exists) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const currentResult = await query<{
      name: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      fixed_monthly_enabled: boolean;
      fixed_monthly_fee: number | null;
      fixed_monthly_start_date: string | null;
      fixed_monthly_end_date: string | null;
      notes: string | null;
    }>(
      `SELECT name, status, start_date, end_date,
              fixed_monthly_enabled, fixed_monthly_fee, fixed_monthly_start_date, fixed_monthly_end_date,
              notes
       FROM projects
       WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    const current = currentResult.rows[0];
    const nextName = (name ?? current.name).trim();
    const nextStatus = status || current.status || "active";
    const nextStartDate = startDate !== undefined ? (startDate || null) : current.start_date;
    const nextEndDate = endDate !== undefined ? (endDate || null) : current.end_date;
    const nextFixedMonthlyEnabled = fixedMonthlyEnabled ?? current.fixed_monthly_enabled;
    const nextFixedMonthlyFee = nextFixedMonthlyEnabled
      ? (fixedMonthlyFee !== undefined ? fixedMonthlyFee : current.fixed_monthly_fee)
      : null;
    const nextFixedMonthlyStartDate = nextFixedMonthlyEnabled
      ? (fixedMonthlyStartDate !== undefined ? (fixedMonthlyStartDate || null) : current.fixed_monthly_start_date)
      : null;
    const nextFixedMonthlyEndDate = nextFixedMonthlyEnabled
      ? (fixedMonthlyEndDate !== undefined ? (fixedMonthlyEndDate || null) : current.fixed_monthly_end_date)
      : null;
    const nextNotes = notes !== undefined ? (notes?.trim() || null) : current.notes;

    if (!nextName || nextName.length === 0) {
      return NextResponse.json(
        { success: false, message: "יש להזין שם פרויקט" },
        { status: 400 }
      );
    }

    if (nextName.length > 200) {
      return NextResponse.json(
        { success: false, message: "שם הפרויקט ארוך מדי (מקסימום 200 תווים)" },
        { status: 400 }
      );
    }

    if (nextFixedMonthlyEnabled && (!(typeof nextFixedMonthlyFee === "number") || nextFixedMonthlyFee <= 0)) {
      return NextResponse.json(
        { success: false, message: "כאשר חיוב חודשי פעיל, יש להזין סכום גדול מ-0" },
        { status: 400 }
      );
    }

    if (
      nextFixedMonthlyStartDate &&
      nextFixedMonthlyEndDate &&
      nextFixedMonthlyStartDate > nextFixedMonthlyEndDate
    ) {
      return NextResponse.json(
        { success: false, message: "תאריך התחלה של חיוב חודשי חייב להיות לפני תאריך הסיום" },
        { status: 400 }
      );
    }

    // Update project
    await query(
      `UPDATE projects
       SET name = $1, status = $2, start_date = $3, end_date = $4,
           fixed_monthly_enabled = $5, fixed_monthly_fee = $6,
           fixed_monthly_start_date = $7, fixed_monthly_end_date = $8,
           notes = $9, updated_at = NOW()
       WHERE id = $10 AND user_id = $11`,
      [
        nextName,
        nextStatus,
        nextStartDate,
        nextEndDate,
        nextFixedMonthlyEnabled,
        nextFixedMonthlyFee,
        nextFixedMonthlyStartDate,
        nextFixedMonthlyEndDate,
        nextNotes,
        projectId,
        user.id,
      ]
    );

    // Fetch the updated project with client info
    const projectResult = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      fixed_monthly_enabled: boolean;
      fixed_monthly_fee: number | null;
      fixed_monthly_start_date: string | null;
      fixed_monthly_end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.status, p.start_date, p.end_date,
              p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
              p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1`,
      [projectId]
    );

    const project = projectResult.rows[0];

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        clientName: project.client_name,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        fixedMonthlyEnabled: project.fixed_monthly_enabled,
        fixedMonthlyFee: project.fixed_monthly_fee,
        fixedMonthlyStartDate: project.fixed_monthly_start_date,
        fixedMonthlyEndDate: project.fixed_monthly_end_date,
        notes: project.notes,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעדכון הפרויקט" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: projectId } = await params;

    // Verify project exists and belongs to user before deleting
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1 AND user_id = $2) as exists`,
      [projectId, user.id]
    );

    if (!checkResult.rows[0].exists) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    // Hard delete - remove the project
    await query(
      `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    return NextResponse.json({
      success: true,
      message: "הפרויקט נמחק בהצלחה",
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת הפרויקט" },
      { status: 500 }
    );
  }
}
