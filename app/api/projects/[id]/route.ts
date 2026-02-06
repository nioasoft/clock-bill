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

    const totalDurationMs = statsResult.rows[0].total_duration || 0;
    const totalHours = totalDurationMs / 3600000; // Convert milliseconds to hours

    // Calculate total amount based on pricing model
    let totalAmount = 0;
    const pricingModel = project.pricing_model;

    if (pricingModel === "hourly" && project.hourly_rate) {
      totalAmount = totalHours * project.hourly_rate;
    } else if (pricingModel === "package") {
      // For package model, amount is the package price
      totalAmount = project.package_price || 0;
    } else if (pricingModel === "mixed") {
      // For mixed model: package price + overage hours * overage rate
      const packageHours = project.package_hours || 0;
      const overageHours = Math.max(0, totalHours - packageHours);
      totalAmount = (project.package_price || 0) + (overageHours * (project.overage_rate || 0));
    } else if (pricingModel === "fixed") {
      // For fixed budget, amount is the fixed budget
      totalAmount = project.fixed_budget || 0;
    } else if (pricingModel === "retainer") {
      // For retainer, amount is monthly fee
      totalAmount = project.retainer_monthly_fee || 0;
    }

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
        totalHours,
        totalAmount,
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
      pricingModel,
      hourlyRate,
      packagePrice,
      packageHours,
      overageRate,
      fixedBudget,
      retainerMonthlyFee,
      retainerHours,
      currency,
      status,
      startDate,
      endDate,
      notes,
    } = body;
    const { id: projectId } = await params;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "יש להזין שם פרויקט" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { success: false, message: "שם הפרויקט ארוך מדי (מקסימום 200 תווים)" },
        { status: 400 }
      );
    }

    if (!pricingModel || !["hourly", "package", "mixed", "fixed", "retainer"].includes(pricingModel)) {
      // Note: 'archived' is a status, not a pricing model
      return NextResponse.json(
        { success: false, message: "יש לבחור מודל תמחור תקין" },
        { status: 400 }
      );
    }

    // Validate pricing model fields
    if (pricingModel === "hourly" && (hourlyRate === undefined || hourlyRate === null || hourlyRate < 0)) {
      return NextResponse.json(
        { success: false, message: "יש להזין תעריף שעתי תקין" },
        { status: 400 }
      );
    }

    if (pricingModel === "package") {
      if (packagePrice === undefined || packagePrice === null || packagePrice < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מחיר חבילה תקין" },
          { status: 400 }
        );
      }
      if (packageHours === undefined || packageHours === null || packageHours < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מספר שעות בחבילה" },
          { status: 400 }
        );
      }
    }

    if (pricingModel === "mixed") {
      if (hourlyRate === undefined || hourlyRate === null || hourlyRate < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין תעריף שעתי תקין" },
          { status: 400 }
        );
      }
      if (packagePrice === undefined || packagePrice === null || packagePrice < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מחיר חבילה תקין" },
          { status: 400 }
        );
      }
      if (packageHours === undefined || packageHours === null || packageHours < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מספר שעות בחבילה" },
          { status: 400 }
        );
      }
      if (overageRate === undefined || overageRate === null || overageRate < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין תעריף גרוע מעל החבילה" },
          { status: 400 }
        );
      }
    }

    if (pricingModel === "fixed") {
      if (fixedBudget === undefined || fixedBudget === null || fixedBudget < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין תקציב כולל תקין" },
          { status: 400 }
        );
      }
    }

    if (pricingModel === "retainer") {
      if (retainerMonthlyFee === undefined || retainerMonthlyFee === null || retainerMonthlyFee < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין את התשלום החודשי" },
          { status: 400 }
        );
      }
      if (retainerHours === undefined || retainerHours === null || retainerHours < 0) {
        return NextResponse.json(
          { success: false, message: "יש להזין מספר שעות בחבילה" },
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

    // Update project
    await query(
      `UPDATE projects
       SET name = $1, pricing_model = $2, hourly_rate = $3, package_price = $4,
           package_hours = $5, overage_rate = $6, fixed_budget = $7,
           retainer_monthly_fee = $8, retainer_hours = $9, currency = $10, status = $11,
           start_date = $12, end_date = $13, notes = $14
       WHERE id = $15 AND user_id = $16`,
      [
        name.trim(),
        pricingModel,
        hourlyRate !== undefined && hourlyRate !== null ? hourlyRate : null,
        packagePrice !== undefined && packagePrice !== null ? packagePrice : null,
        packageHours !== undefined && packageHours !== null ? packageHours : null,
        overageRate !== undefined && overageRate !== null ? overageRate : null,
        fixedBudget !== undefined && fixedBudget !== null ? fixedBudget : null,
        retainerMonthlyFee !== undefined && retainerMonthlyFee !== null ? retainerMonthlyFee : null,
        retainerHours !== undefined && retainerHours !== null ? retainerHours : null,
        currency || "ILS",
        status || "active",
        startDate || null,
        endDate || null,
        notes?.trim() || null,
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
