import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * POST /api/projects/[id]/duplicate
 * Duplicate an existing project
 */
export async function POST(
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

    // Get the original project
    const originalResult = await query<{
      id: string;
      name: string;
      client_id: string;
      pricing_model: string;
      hourly_rate: number | null;
      package_price: number | null;
      package_hours: number | null;
      overage_rate: number | null;
      fixed_budget: number | null;
      retainer_monthly_fee: number | null;
      retainer_hours: number | null;
      currency: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
    }>(
      `SELECT id, name, client_id, pricing_model, hourly_rate, package_price, package_hours,
              overage_rate, fixed_budget, retainer_monthly_fee, retainer_hours,
              currency, status, start_date, end_date, notes
       FROM projects
       WHERE id = $1 AND user_id = $2`,
      [projectId, user.id]
    );

    if (originalResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const original = originalResult.rows[0];

    // Generate a new name with "(העתק)" suffix
    let newName = `${original.name} (העתק)`;

    // Check if a project with that name already exists, if so add a number
    let suffix = 1;
    let nameExists = true;
    while (nameExists) {
      const checkResult = await query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM projects WHERE name = $1 AND user_id = $2) as exists`,
        [newName, user.id]
      );

      if (!checkResult.rows[0].exists) {
        nameExists = false;
      } else {
        suffix++;
        newName = `${original.name} (העתק ${suffix})`;
      }
    }

    // Generate UUID for new project
    const newProjectIdResult = await query<{ id: string }>(
      `SELECT gen_random_uuid()::text as id`
    );
    const newProjectId = newProjectIdResult.rows[0].id;

    // Insert the duplicated project (with active status and cleared dates)
    await query(
      `INSERT INTO projects (id, user_id, client_id, name, pricing_model, hourly_rate,
                             package_price, package_hours, overage_rate, fixed_budget,
                             retainer_monthly_fee, retainer_hours, currency, status,
                             start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        newProjectId,
        user.id,
        original.client_id,
        newName,
        original.pricing_model,
        original.hourly_rate,
        original.package_price,
        original.package_hours,
        original.overage_rate,
        original.fixed_budget,
        original.retainer_monthly_fee,
        original.retainer_hours,
        original.currency,
        "active", // Always set duplicated projects to active
        null, // Clear start date
        null, // Clear end date
        original.notes,
      ]
    );

    // Fetch the created project with client info
    const projectResult = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      pricing_model: string;
      hourly_rate: number | null;
      package_price: number | null;
      package_hours: number | null;
      overage_rate: number | null;
      fixed_budget: number | null;
      retainer_monthly_fee: number | null;
      retainer_hours: number | null;
      currency: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.pricing_model, p.hourly_rate, p.package_price, p.package_hours, p.overage_rate,
              p.fixed_budget, p.retainer_monthly_fee, p.retainer_hours,
              p.currency, p.status, p.start_date, p.end_date, p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.id = $1`,
      [newProjectId]
    );

    const project = projectResult.rows[0];

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        clientName: project.client_name,
        pricingModel: project.pricing_model,
        hourlyRate: project.hourly_rate,
        packagePrice: project.package_price,
        packageHours: project.package_hours,
        overageRate: project.overage_rate,
        fixedBudget: project.fixed_budget,
        retainerMonthlyFee: project.retainer_monthly_fee,
        retainerHours: project.retainer_hours,
        currency: project.currency,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        notes: project.notes,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error("Error duplicating project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשכפול הפרויקט" },
      { status: 500 }
    );
  }
}
