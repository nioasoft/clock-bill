import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Body schema for creating a project. Cross-field rules stay inline below. */
const createProjectSchema = z.object({
  clientId: z.string({ message: "יש לבחור לקוח" }).trim().min(1, "יש לבחור לקוח"),
  name: z
    .string({ message: "יש להזין שם פרויקט" })
    .trim()
    .min(1, "יש להזין שם פרויקט")
    .max(200, "שם הפרויקט ארוך מדי (מקסימום 200 תווים)"),
  status: z.enum(["active", "completed", "paused", "archived"], { message: "סטטוס לא חוקי" }).nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  fixedMonthlyEnabled: z.boolean().nullish(),
  fixedMonthlyFee: z.number().nullish(),
  fixedMonthlyStartDate: z.string().nullish(),
  fixedMonthlyEndDate: z.string().nullish(),
  // null/absent => inherit the client's rounding; otherwise overrides it.
  billingRounding: z.enum(["none", "hour_up", "half_hour_up"]).nullish(),
  notes: z.string().max(5000).nullish(),
});

/**
 * GET /api/projects
 * Returns all projects for the authenticated user
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

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status"); // "active", "archived", "all", or null (default: exclude archived)

    const { query } = await import("@/lib/db");

    // Build WHERE clause based on status filter
    let whereClause = "";
    const params: (string | number | boolean | null)[] = [user.id];

    if (statusFilter === "archived") {
      whereClause = "AND p.status = 'archived'";
    } else if (statusFilter === "all") {
      // Show all projects, no additional filter
    } else {
      // Default: exclude archived projects
      whereClause = "AND p.status != 'archived'";
    }

    // Get all projects for the user with client info
    const result = await query<{
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
      billing_rounding: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.status, p.start_date, p.end_date,
              p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
              p.billing_rounding, p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.user_id = $1 ${whereClause}
       ORDER BY p.created_at DESC`,
      params
    );

    const projects = result.rows.map((project) => ({
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
      billingRounding: project.billing_rounding,
      notes: project.notes,
      createdAt: project.created_at,
    }));

    return NextResponse.json({
      success: true,
      projects,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הפרויקטים" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, createProjectSchema);
    if (!parsed.ok) return parsed.response;
    const {
      clientId,
      name,
      status,
      startDate,
      endDate,
      fixedMonthlyEnabled,
      fixedMonthlyFee,
      fixedMonthlyStartDate,
      fixedMonthlyEndDate,
      billingRounding,
      notes,
    } = parsed.data;

    if (fixedMonthlyEnabled && (!(typeof fixedMonthlyFee === "number") || fixedMonthlyFee <= 0)) {
      return NextResponse.json(
        { success: false, error_code: "FIXED_MONTHLY_FEE_REQUIRED", message: "כאשר חיוב חודשי פעיל, יש להזין סכום גדול מ-0" },
        { status: 400 }
      );
    }

    if (fixedMonthlyStartDate && fixedMonthlyEndDate && fixedMonthlyStartDate > fixedMonthlyEndDate) {
      return NextResponse.json(
        { success: false, error_code: "FIXED_MONTHLY_DATE_RANGE_INVALID", message: "תאריך התחלה של חיוב חודשי חייב להיות לפני תאריך הסיום" },
        { status: 400 }
      );
    }

    const { query } = await import("@/lib/db");

    // Verify the client belongs to this user
    const clientCheck = await query<{ id: string }>(
      `SELECT id FROM clients WHERE id = $1 AND user_id = $2`,
      [clientId, user.id]
    );

    if (clientCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    // Insert project
    const insertResult = await query<{ id: string }>(
      `INSERT INTO projects (
        id, user_id, client_id, name, status, start_date, end_date,
        fixed_monthly_enabled, fixed_monthly_fee, fixed_monthly_start_date, fixed_monthly_end_date,
        billing_rounding, notes
      )
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        user.id,
        clientId,
        name.trim(),
        status || "active",
        startDate || null,
        endDate || null,
        fixedMonthlyEnabled ?? false,
        fixedMonthlyEnabled ? fixedMonthlyFee : null,
        fixedMonthlyEnabled ? (fixedMonthlyStartDate || null) : null,
        fixedMonthlyEnabled ? (fixedMonthlyEndDate || null) : null,
        billingRounding ?? null,
        notes?.trim() || null,
      ]
    );

    const projectId = insertResult.rows[0].id;

    // Fetch the created project with client info
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
      billing_rounding: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.status, p.start_date, p.end_date,
              p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
              p.billing_rounding, p.notes, p.created_at
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
        billingRounding: project.billing_rounding,
        notes: project.notes,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה ביצירת הפרויקט" },
      { status: 500 }
    );
  }
}
