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
  billingRounding: z.enum(["none", "hour_up", "half_hour_up"]).nullish(),
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: clientId } = await params;

    // Get client (+ verify ownership) and rates in parallel — both key off
    // clientId + user.id, so they're independent. A non-owned id just returns
    // empty rows for both; the 404 below is driven by the client result.
    const [result, ratesResult] = await Promise.all([
      query<{
        id: string;
        name: string;
        contact_name: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        default_rate: number | null;
        currency: string | null;
        billing_rounding: string | null;
        is_retainer: boolean | null;
        retainer_hours: number | null;
        retainer_monthly_fee: number | null;
        overage_rate: number | null;
        notes: string | null;
        is_active: boolean;
        created_at: string;
      }>(
        `SELECT id, name, contact_name, email, phone, address, default_rate,
                currency, billing_rounding, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate,
                notes, is_active, created_at
         FROM clients
         WHERE id = $1 AND user_id = $2`,
        [clientId, user.id]
      ),
      query<{
        id: string; kind: string; name: string; rate: number; is_default: boolean;
      }>(
        `SELECT id, kind, name, rate, is_default
         FROM client_rates WHERE client_id = $1 AND user_id = $2
         ORDER BY kind, is_default DESC, name`,
        [clientId, user.id]
      ),
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const client = result.rows[0];

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
        billingRounding: client.billing_rounding || "none",
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
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הלקוח" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, updateClientSchema);
    if (!parsed.ok) return parsed.response;
    const { name, contactName, email, phone, address, defaultRate, currency, billingRounding, isRetainer, retainerHours, retainerMonthlyFee, overageRate, notes, rates } = parsed.data;
    const { id: clientId } = await params;

    const { withTransaction } = await import("@/lib/db");

    // rates === undefined (key absent) => caller didn't manage rates; leave them
    // untouched (the [id] detail form PUTs without rates). An explicit [] wipes them.
    const ratesList = rates ?? null;
    const defaultHourly =
      ratesList?.find((r) => r.kind === "hourly" && r.isDefault) ??
      ratesList?.find((r) => r.kind === "hourly");
    // Sync default_rate to the default hourly rate when one is present. When the
    // caller sends rates but no hourly rate (e.g. items-only), pass null and let
    // the COALESCE below PRESERVE the existing default_rate (don't zero it). When
    // the caller didn't manage rates (detail form), use its submitted defaultRate.
    const effectiveDefaultRate = ratesList !== null
      ? (defaultHourly ? defaultHourly.rate : null)
      : (defaultRate ?? null);

    type ClientRow = {
      id: string;
      name: string;
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      address: string | null;
      default_rate: number | null;
      currency: string | null;
      billing_rounding: string | null;
      is_retainer: boolean | null;
      retainer_hours: number | null;
      retainer_monthly_fee: number | null;
      overage_rate: number | null;
      notes: string | null;
      is_active: boolean;
      created_at: string;
    };
    type RateRow = { id: string; kind: string; name: string; rate: number; is_default: boolean };

    // Update client + replace rates + re-read both, all in ONE transaction
    // (single connection, single begin/commit; still scoped by user_id; RLS bound).
    const txResult = await withTransaction(async (db) => {
      const updateResult = await db.query<ClientRow>(
        `UPDATE clients
         SET name = $1, contact_name = $2, email = $3, phone = $4, address = $5, default_rate = COALESCE($6, default_rate),
             currency = $7, is_retainer = $8, retainer_hours = $9, retainer_monthly_fee = $10, overage_rate = $11,
             notes = $12, billing_rounding = COALESCE($13, billing_rounding)
         WHERE id = $14 AND user_id = $15
         RETURNING id, name, contact_name, email, phone, address, default_rate,
                   currency, billing_rounding, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate,
                   notes, is_active, created_at`,
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
          billingRounding ?? null,
          clientId,
          user.id,
        ]
      );

      // 404 driven by the UPDATE's RETURNING (no separate EXISTS round-trip).
      if (updateResult.rows.length === 0) {
        return { notFound: true as const };
      }

      if (ratesList !== null) {
        await db.query(`DELETE FROM client_rates WHERE client_id = $1 AND user_id = $2`, [clientId, user.id]);
        if (ratesList.length > 0) {
          // One multi-row INSERT via unnest over parallel arrays — preserves the
          // exact per-rate field mapping of the old per-row INSERT.
          const kinds = ratesList.map((r) => r.kind);
          const names = ratesList.map((r) => r.name.trim());
          const rateValues = ratesList.map((r) => r.rate);
          const isDefaults = ratesList.map((r) => (r.kind === "hourly" ? r.isDefault : false));
          await db.query(
            `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default)
             SELECT gen_random_uuid()::text, $1, $2, k, n, rt, d
             FROM unnest($3::text[], $4::text[], $5::numeric[], $6::boolean[]) AS t(k, n, rt, d)`,
            [user.id, clientId, kinds, names, rateValues, isDefaults]
          );
        }
      }

      // Re-read rates inside the same transaction (reuses the one connection).
      const ratesResult = await db.query<RateRow>(
        `SELECT id, kind, name, rate, is_default
         FROM client_rates WHERE client_id = $1 AND user_id = $2
         ORDER BY kind, is_default DESC, name`,
        [clientId, user.id]
      );

      return { notFound: false as const, client: updateResult.rows[0], rateRows: ratesResult.rows };
    });

    if (txResult.notFound) {
      return NextResponse.json(
        { success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const client = txResult.client;
    const updatedRates = txResult.rateRows.map((r) => ({
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
        billingRounding: client.billing_rounding || "none",
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
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון הלקוח" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    // Reactivating a client consumes a slot. Read the plan tier up front; the cap
    // is enforced ATOMICALLY inside the transaction below (per-user advisory lock)
    // to close a TOCTOU race where concurrent reactivations could exceed the cap.
    const { getUserPlan } = await import("@/lib/entitlements");
    const { canAddClient } = await import("@/lib/plans");
    const plan = await getUserPlan(user.id);

    const { withTransaction } = await import("@/lib/db");
    const { id: clientId } = await params;

    type RestoredClientRow = {
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
    };

    const result = await withTransaction(async (db) => {
      // Serialize concurrent create/reactivate calls FOR THIS USER on a per-user
      // advisory lock so the COUNT below always sees the prior txn's committed state.
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`clients:${user.id}`]);

      const countRes = await db.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM clients WHERE user_id = $1 AND is_active = TRUE",
        [user.id]
      );
      const activeCount = parseInt(countRes.rows[0]?.count ?? "0", 10);
      if (!canAddClient(plan.tier, activeCount)) {
        return { overLimit: true as const };
      }

      // Restore - set is_active to TRUE; RETURNING the needed cols collapses the
      // update + existence check + re-read into one round-trip.
      const clientResult = await db.query<RestoredClientRow>(
        `UPDATE clients
         SET is_active = TRUE
         WHERE id = $1 AND user_id = $2
         RETURNING id, name, contact_name, email, phone, address, default_rate, notes, is_active, created_at`,
        [clientId, user.id]
      );

      return { overLimit: false as const, client: clientResult.rows[0] as RestoredClientRow | undefined };
    });

    if (result.overLimit) {
      return NextResponse.json(
        {
          success: false,
          error_code: "PLAN_LIMIT_REACHED",
          message: "הגעת למגבלת הלקוחות בתוכנית שלך. שדרגו כדי לשחזר לקוח זה.",
        },
        { status: 402 }
      );
    }

    if (!result.client) {
      return NextResponse.json(
        { success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" },
        { status: 404 }
      );
    }

    const client = result.client;

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
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בשחזור הלקוח" },
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
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");
    const { id: clientId } = await params;

    // Soft delete - set is_active to FALSE; RETURNING id collapses the update +
    // existence check into one round-trip (404 when no row matched).
    const deleteResult = await query<{ id: string }>(
      `UPDATE clients
       SET is_active = FALSE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [clientId, user.id]
    );

    if (deleteResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error_code: "CLIENT_NOT_FOUND", message: "הלקוח לא נמצא" },
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
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת הלקוח" },
      { status: 500 }
    );
  }
}
