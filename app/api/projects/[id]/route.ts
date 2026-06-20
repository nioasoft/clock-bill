import { createLogger } from "@/lib/logger";
const logger = createLogger("api:projects:id");
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/**
 * Body schema for updating a project. All fields are optional (partial update);
 * the route merges them onto current values, and cross-field rules stay inline.
 */
const updateProjectSchema = z.object({
  name: z.string().max(200, "שם הפרויקט ארוך מדי (מקסימום 200 תווים)").optional(),
  status: z.enum(["active", "completed", "paused", "archived"], { message: "סטטוס לא חוקי" }).optional(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  fixedMonthlyEnabled: z.boolean().nullish(),
  fixedMonthlyFee: z.number().nullish(),
  fixedMonthlyStartDate: z.string().nullish(),
  fixedMonthlyEndDate: z.string().nullish(),
  // Present (incl. null) => set the override (null = inherit client); absent => leave unchanged.
  billingRounding: z.enum(["none", "tenth_hour_up", "quarter_hour_up", "half_hour_up", "hour_up"]).nullish(),
  notes: z.string().max(5000).nullish(),
});

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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: projectId } = await params;

    // Get project (verify ownership) and time-entry stats concurrently.
    // The stats query filters by projectId + user.id directly, so it does not
    // depend on the project SELECT result — run both in parallel (~3 RTT total).
    const [result, statsResult] = await Promise.all([
      query<{
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
        billing_rounding: string | null;
        client_billing_rounding: string | null;
        notes: string | null;
        created_at: string;
      }>(
        `SELECT p.id, p.name, p.client_id, c.name as client_name,
                c.default_rate, c.currency,
                p.status, p.start_date, p.end_date,
                p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
                p.billing_rounding, c.billing_rounding as client_billing_rounding,
                p.notes, p.created_at
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1 AND p.user_id = $2`,
        [projectId, user.id]
      ),
      query<{
        total_duration: number;
      }>(
        `SELECT COALESCE(SUM(duration), 0) as total_duration
         FROM time_entries
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, user.id]
      ),
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const project = result.rows[0];

    // Calculate total hours and amount from time entries
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
        billingRounding: project.billing_rounding,
        clientBillingRounding: project.client_billing_rounding || "none",
        notes: project.notes,
        createdAt: project.created_at,
        totalHours,
        totalAmount,
        currency: project.currency || "ILS",
      },
    });
  } catch (error) {
    logger.error("Error fetching project:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הפרויקט" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, updateProjectSchema);
    if (!parsed.ok) return parsed.response;
    const {
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
    const { id: projectId } = await params;

    const { withTransaction } = await import("@/lib/db");

    // Read current row, UPDATE, and re-SELECT (joined for client_name) all share
    // ONE connection / ONE begin-commit. The current-row SELECT doubles as the
    // existence/ownership check (0 rows => 404), removing the redundant EXISTS query.
    const result = await withTransaction(async (client) => {
      const currentResult = await client.query<{
        client_id: string;
        name: string;
        status: string;
        start_date: string | null;
        end_date: string | null;
        fixed_monthly_enabled: boolean;
        fixed_monthly_fee: number | null;
        fixed_monthly_start_date: string | null;
        fixed_monthly_end_date: string | null;
        billing_rounding: string | null;
        notes: string | null;
      }>(
        `SELECT client_id, name, status, start_date, end_date,
                fixed_monthly_enabled, fixed_monthly_fee, fixed_monthly_start_date, fixed_monthly_end_date,
                billing_rounding, notes
         FROM projects
         WHERE id = $1 AND user_id = $2`,
        [projectId, user.id]
      );

      if (currentResult.rows.length === 0) {
        return { notFound: true as const };
      }

      const { getLockedClientIds } = await import("@/lib/plan-guard");
      if ((await getLockedClientIds(user.id)).has(currentResult.rows[0].client_id)) {
        return { planLocked: true as const };
      }

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
      // Present (incl. explicit null = inherit client) updates; absent leaves as-is.
      const nextBillingRounding = billingRounding !== undefined ? (billingRounding ?? null) : current.billing_rounding;

      // Validation errors are returned as structured results and converted to
      // 400 responses outside the transaction (which rolls back automatically).
      if (!nextName || nextName.length === 0) {
        return { validationError: "יש להזין שם פרויקט" as const };
      }

      if (nextName.length > 200) {
        return { validationError: "שם הפרויקט ארוך מדי (מקסימום 200 תווים)" as const };
      }

      if (nextFixedMonthlyEnabled && (!(typeof nextFixedMonthlyFee === "number") || nextFixedMonthlyFee <= 0)) {
        return { validationError: "כאשר חיוב חודשי פעיל, יש להזין סכום גדול מ-0" as const };
      }

      if (
        nextFixedMonthlyStartDate &&
        nextFixedMonthlyEndDate &&
        nextFixedMonthlyStartDate > nextFixedMonthlyEndDate
      ) {
        return { validationError: "תאריך התחלה של חיוב חודשי חייב להיות לפני תאריך הסיום" as const };
      }

      // Update project, returning the updated row.
      const updateResult = await client.query<{
        id: string;
        name: string;
        client_id: string;
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
        `UPDATE projects
         SET name = $1, status = $2, start_date = $3, end_date = $4,
             fixed_monthly_enabled = $5, fixed_monthly_fee = $6,
             fixed_monthly_start_date = $7, fixed_monthly_end_date = $8,
             notes = $9, billing_rounding = $10, updated_at = NOW()
         WHERE id = $11 AND user_id = $12
         RETURNING id, client_id, name, status, start_date, end_date,
                   fixed_monthly_enabled, fixed_monthly_fee, fixed_monthly_start_date, fixed_monthly_end_date,
                   billing_rounding, notes, created_at`,
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
          nextBillingRounding,
          projectId,
          user.id,
        ]
      );

      const updated = updateResult.rows[0];

      // Resolve client_name (JOIN) within the same connection/transaction.
      const clientResult = await client.query<{ client_name: string }>(
        `SELECT c.name as client_name
         FROM clients c
         WHERE c.id = $1`,
        [updated.client_id]
      );

      return {
        project: {
          id: updated.id,
          name: updated.name,
          client_id: updated.client_id,
          client_name: clientResult.rows[0].client_name,
          status: updated.status,
          start_date: updated.start_date,
          end_date: updated.end_date,
          fixed_monthly_enabled: updated.fixed_monthly_enabled,
          fixed_monthly_fee: updated.fixed_monthly_fee,
          fixed_monthly_start_date: updated.fixed_monthly_start_date,
          fixed_monthly_end_date: updated.fixed_monthly_end_date,
          billing_rounding: updated.billing_rounding,
          notes: updated.notes,
          created_at: updated.created_at,
        },
      };
    });

    if ("notFound" in result) {
      return NextResponse.json(
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const { isPlanLockedSentinel, lockedClientResponse } = await import("@/lib/plan-guard");
    if (isPlanLockedSentinel(result)) return lockedClientResponse();

    if ("validationError" in result) {
      return NextResponse.json(
        { success: false, error_code: "VALIDATION_ERROR", message: result.validationError },
        { status: 400 }
      );
    }

    const project = result.project;

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
    logger.error("Error updating project:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון הפרויקט" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
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
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "הפרויקט לא נמצא" },
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
    logger.error("Error deleting project:", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת הפרויקט" },
      { status: 500 }
    );
  }
}
