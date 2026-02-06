import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * GET /api/projects
 * Returns all projects for the authenticated user
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

    // Get all projects for the user with client info
    const result = await query<{
      id: string;
      name: string;
      client_id: string;
      client_name: string;
      pricing_model: string;
      hourly_rate: number | null;
      package_price: number | null;
      package_hours: number | null;
      overage_rate: number | null;
      currency: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.pricing_model, p.hourly_rate, p.package_price, p.package_hours, p.overage_rate,
              p.currency, p.status, p.start_date, p.end_date, p.notes, p.created_at
       FROM projects p
       JOIN clients c ON p.client_id = c.id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [user.id]
    );

    const projects = result.rows.map((project) => ({
      id: project.id,
      name: project.name,
      clientId: project.client_id,
      clientName: project.client_name,
      pricingModel: project.pricing_model,
      hourlyRate: project.hourly_rate,
      packagePrice: project.package_price,
      packageHours: project.package_hours,
      overageRate: project.overage_rate,
      currency: project.currency,
      status: project.status,
      startDate: project.start_date,
      endDate: project.end_date,
      notes: project.notes,
      createdAt: project.created_at,
    }));

    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הפרויקטים" },
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
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      clientId,
      name,
      pricingModel,
      hourlyRate,
      packagePrice,
      packageHours,
      overageRate,
      currency,
      status,
      startDate,
      endDate,
      notes,
    } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "יש להזין שם פרויקט" },
        { status: 400 }
      );
    }

    if (!clientId || clientId.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "יש לבחור לקוח" },
        { status: 400 }
      );
    }

    if (!pricingModel || !["hourly", "package", "mixed"].includes(pricingModel)) {
      return NextResponse.json(
        { success: false, message: "יש לבחור מודל תמחור תקין" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { success: false, message: "שם הפרויקט ארוך מדי (מקסימום 200 תווים)" },
        { status: 400 }
      );
    }

    // Validate pricing model fields
    if (pricingModel === "hourly" && (!hourlyRate || hourlyRate < 0)) {
      return NextResponse.json(
        { success: false, message: "יש להזין תעריף שעתי תקין" },
        { status: 400 }
      );
    }

    if (pricingModel === "package") {
      if (!packagePrice || packagePrice < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מחיר חבילה תקין" },
          { status: 400 }
        );
      }
      if (!packageHours || packageHours < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מספר שעות בחבילה" },
          { status: 400 }
        );
      }
    }

    if (pricingModel === "mixed") {
      if (!hourlyRate || hourlyRate < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין תעריף שעתי תקין" },
          { status: 400 }
        );
      }
      if (!packagePrice || packagePrice < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מחיר חבילה תקין" },
          { status: 400 }
        );
      }
      if (!packageHours || packageHours < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מספר שעות בחבילה" },
          { status: 400 }
        );
      }
      if (!overageRate || overageRate < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין תעריף גרוע מעל החבילה" },
          { status: 400 }
        );
      }
    }

    if (currency && !["ILS", "USD", "USDT", "BTC", "ETH"].includes(currency)) {
      return NextResponse.json(
        { success: false, message: "מטבע לא חוקי" },
        { status: 400 }
      );
    }

    if (status && !["active", "completed", "paused"].includes(status)) {
      return NextResponse.json(
        { success: false, message: "סטטוס לא חוקי" },
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
        { success: false, message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    // Generate UUID for new project
    const projectIdResult = await query<{ id: string }>(
      `SELECT gen_random_uuid()::text as id`
    );
    const projectId = projectIdResult.rows[0].id;

    // Insert project
    await query(
      `INSERT INTO projects (id, user_id, client_id, name, pricing_model, hourly_rate,
                             package_price, package_hours, overage_rate, currency, status,
                             start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        projectId,
        user.id,
        clientId,
        name.trim(),
        pricingModel,
        hourlyRate || null,
        packagePrice || null,
        packageHours || null,
        overageRate || null,
        currency || "ILS",
        status || "active",
        startDate || null,
        endDate || null,
        notes?.trim() || null,
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
      currency: string;
      status: string;
      start_date: string | null;
      end_date: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT p.id, p.name, p.client_id, c.name as client_name,
              p.pricing_model, p.hourly_rate, p.package_price, p.package_hours, p.overage_rate,
              p.currency, p.status, p.start_date, p.end_date, p.notes, p.created_at
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
        pricingModel: project.pricing_model,
        hourlyRate: project.hourly_rate,
        packagePrice: project.package_price,
        packageHours: project.package_hours,
        overageRate: project.overage_rate,
        currency: project.currency,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        notes: project.notes,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הפרויקט" },
      { status: 500 }
    );
  }
}
