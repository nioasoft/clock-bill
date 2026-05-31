import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { clientRatesSchema } from "@/lib/schemas/rates";

/** Body schema for updating a client. Mirrors the previously inline checks. */
const updateClientSchema = z.object({
  name: z
    .string({ message: "יש להזין שם לקוח" })
    .trim()
    .min(1, "יש להזין שם לקוח")
    .max(200, "שם הלקוח ארוך מדי (מקסימום 200 תווים)"),
  contactName: z.string().max(200).nullish(),
  email: z.string().max(200, "כתובת האימייל ארוכה מדי").nullish(),
  phone: z.string().max(50, "מספר הטלפון ארוך מדי").nullish(),
  address: z.string().max(500, "הכתובת ארוכה מדי (מקסימום 500 תווים)").nullish(),
  defaultRate: z
    .number()
    .min(0, "התעריף השעתי לא יכול להיות שלילי")
    .nullish(),
  currency: z.string().max(10).nullish(),
  isRetainer: z.boolean().nullish(),
  retainerHours: z.number().nullish(),
  retainerMonthlyFee: z.number().nullish(),
  overageRate: z.number().nullish(),
  notes: z.string().max(5000).nullish(),
  rates: clientRatesSchema.nullish(),
});

/**
 * GET /api/clients/[id]
 * Get a single client by ID
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
    const { id: clientId } = await params;

    // Get client and verify ownership
    const result = await query<{
      id: string;
      name: string;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      default_rate: number | null;
      currency: string | null;
      is_retainer: boolean | null;
      retainer_hours: number | null;
      retainer_monthly_fee: number | null;
      overage_rate: number | null;
      notes: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, name, contact_name, email, phone, address, default_rate,
              currency, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate,
              notes, is_active, created_at
       FROM clients
       WHERE id = $1 AND user_id = $2`,
      [clientId, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const client = result.rows[0];

    const ratesResult = await query<{
      id: string; kind: string; name: string; rate: number; is_default: boolean;
    }>(
      `SELECT id, kind, name, rate, is_default
       FROM client_rates WHERE client_id = $1 AND user_id = $2
       ORDER BY kind, is_default DESC, name`,
      [clientId, user.id]
    );
    const rates = ratesResult.rows.map((r) => ({
      id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default,
    }));

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        contactName: client.contact_name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        defaultRate: client.default_rate,
        currency: client.currency || "ILS",
        isRetainer: client.is_retainer ?? false,
        retainerHours: client.retainer_hours,
        retainerMonthlyFee: client.retainer_monthly_fee,
        overageRate: client.overage_rate,
        notes: client.notes,
        isActive: client.is_active,
        createdAt: client.created_at,
        rates,
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הלקוח" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/clients/[id]
 * Update an existing client
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

    const parsed = await parseBody(request, updateClientSchema);
    if (!parsed.ok) return parsed.response;
    const { name, contactName, email, phone, address, defaultRate, currency, isRetainer, retainerHours, retainerMonthlyFee, overageRate, notes, rates } = parsed.data;
    const { id: clientId } = await params;

    const { query, withTransaction } = await import("@/lib/db");

    // Verify ownership BEFORE mutating
    const ownershipCheck = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM clients WHERE id = $1 AND user_id = $2) as exists`,
      [clientId, user.id]
    );

    if (!ownershipCheck.rows[0].exists) {
      return NextResponse.json(
        { success: false, message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    // rates === undefined (key absent) => caller didn't manage rates; leave them
    // untouched (the [id] detail form PUTs without rates). An explicit [] wipes them.
    const ratesList = rates ?? null;
    const defaultHourly =
      ratesList?.find((r) => r.kind === "hourly" && r.isDefault) ??
      ratesList?.find((r) => r.kind === "hourly");
    // Only override default_rate when the caller actually sent rates.
    const effectiveDefaultRate = ratesList !== null
      ? (defaultHourly ? defaultHourly.rate : null)
      : (defaultRate ?? null);

    // Update client + replace rates atomically (still scoped by user_id; RLS bound).
    await withTransaction(async (db) => {
      await db.query(
        `UPDATE clients
         SET name = $1, contact_name = $2, email = $3, phone = $4, address = $5, default_rate = $6,
             currency = $7, is_retainer = $8, retainer_hours = $9, retainer_monthly_fee = $10, overage_rate = $11,
             notes = $12
         WHERE id = $13 AND user_id = $14`,
        [
          name.trim(),
          contactName?.trim() || null,
          email?.trim() || null,
          phone?.trim() || null,
          address?.trim() || null,
          effectiveDefaultRate,
          currency || "ILS",
          isRetainer ?? false,
          retainerHours || null,
          retainerMonthlyFee || null,
          overageRate || null,
          notes?.trim() || null,
          clientId,
          user.id,
        ]
      );

      if (ratesList !== null) {
        await db.query(`DELETE FROM client_rates WHERE client_id = $1 AND user_id = $2`, [clientId, user.id]);
        for (const r of ratesList) {
          await db.query(
            `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)`,
            [user.id, clientId, r.kind, r.name.trim(), r.rate, r.kind === "hourly" ? r.isDefault : false]
          );
        }
      }
    });

    // Fetch the updated client (scoped by user_id)
    const clientResult = await query<{
      id: string;
      name: string;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      default_rate: number | null;
      currency: string | null;
      is_retainer: boolean | null;
      retainer_hours: number | null;
      retainer_monthly_fee: number | null;
      overage_rate: number | null;
      notes: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, name, contact_name, email, phone, address, default_rate,
              currency, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate,
              notes, is_active, created_at
       FROM clients
       WHERE id = $1 AND user_id = $2`,
      [clientId, user.id]
    );

    const client = clientResult.rows[0];

    const ratesResult = await query<{
      id: string; kind: string; name: string; rate: number; is_default: boolean;
    }>(
      `SELECT id, kind, name, rate, is_default
       FROM client_rates WHERE client_id = $1 AND user_id = $2
       ORDER BY kind, is_default DESC, name`,
      [clientId, user.id]
    );
    const updatedRates = ratesResult.rows.map((r) => ({
      id: r.id, kind: r.kind as "hourly" | "item", name: r.name, rate: r.rate, isDefault: r.is_default,
    }));

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        name: client.name,
        contactName: client.contact_name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        defaultRate: client.default_rate,
        currency: client.currency || "ILS",
        isRetainer: client.is_retainer ?? false,
        retainerHours: client.retainer_hours,
        retainerMonthlyFee: client.retainer_monthly_fee,
        overageRate: client.overage_rate,
        notes: client.notes,
        isActive: client.is_active,
        createdAt: client.created_at,
        rates: updatedRates,
      },
    });
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעדכון הלקוח" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]
 * Restore (reactivate) an archived client
 */
export async function PATCH(
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
    const { id: clientId } = await params;

    // Restore - set is_active to TRUE
    await query(
      `UPDATE clients
       SET is_active = TRUE
       WHERE id = $1 AND user_id = $2`,
      [clientId, user.id]
    );

    // Check if client exists and was updated
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM clients WHERE id = $1 AND user_id = $2) as exists`,
      [clientId, user.id]
    );

    if (!checkResult.rows[0].exists) {
      return NextResponse.json(
        { success: false, message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    // Fetch the restored client
    const clientResult = await query<{
      id: string;
      name: string;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      default_rate: number | null;
      notes: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, name, contact_name, email, phone, address, default_rate, notes, is_active, created_at
       FROM clients
       WHERE id = $1`,
      [clientId]
    );

    const client = clientResult.rows[0];

    return NextResponse.json({
      success: true,
      message: "הלקוח שוחזר בהצלחה",
      client: {
        id: client.id,
        name: client.name,
        contactName: client.contact_name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        defaultRate: client.default_rate,
        notes: client.notes,
        isActive: client.is_active,
        createdAt: client.created_at,
      },
    });
  } catch (error) {
    console.error("Error restoring client:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשחזור הלקוח" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete (deactivate) a client
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
    const { id: clientId } = await params;

    // Soft delete - set is_active to FALSE
    await query(
      `UPDATE clients
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2`,
      [clientId, user.id]
    );

    // Check if client exists and was updated
    const checkResult = await query<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM clients WHERE id = $1 AND user_id = $2) as exists`,
      [clientId, user.id]
    );

    if (!checkResult.rows[0].exists) {
      return NextResponse.json(
        { success: false, message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "הלקוח נמחק בהצלחה",
    });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת הלקוח" },
      { status: 500 }
    );
  }
}
