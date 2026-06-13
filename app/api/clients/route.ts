import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { clientRatesSchema } from "@/lib/schemas/rates";
import { createLogger } from "@/lib/logger";

const logger = createLogger("clients:list");

/** Body schema for creating a client. Mirrors the previously inline checks. */
const createClientSchema = z.object({
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
  billingRounding: z.enum(["none", "tenth_hour_up", "quarter_hour_up", "half_hour_up", "hour_up"]).nullish(),
  isRetainer: z.boolean().nullish(),
  retainerHours: z.number().nullish(),
  retainerMonthlyFee: z.number().nullish(),
  overageRate: z.number().nullish(),
  notes: z.string().max(5000).nullish(),
  rates: clientRatesSchema.nullish(),
});

/**
 * GET /api/clients
 * List all clients for the authenticated user
 */
export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" },
        { status: 401 }
      );
    }

    const { query } = await import("@/lib/db");

    // Get all clients for this user with billed amounts and total hours
    const result = await query<{
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
      total_billed: string | null;
      total_hours: number | null;
    }>(
      `SELECT c.id, c.name, c.contact_name, c.email, c.phone, c.address, c.default_rate,
              c.currency, c.billing_rounding, c.is_retainer, c.retainer_hours, c.retainer_monthly_fee, c.overage_rate,
              c.notes, c.is_active, c.created_at,
              COALESCE(SUM(
                CASE
                  WHEN te.is_billable = TRUE THEN
                    COALESCE(c.default_rate, 0) * (te.duration / 60.0)
                  ELSE 0
                END
              ), 0) as total_billed,
              COALESCE(SUM(te.duration), 0) / 60.0 as total_hours
       FROM clients c
       LEFT JOIN projects p ON p.client_id = c.id
       LEFT JOIN time_entries te ON te.project_id = p.id
       WHERE c.user_id = $1
       GROUP BY c.id, c.name, c.contact_name, c.email, c.phone, c.address, c.default_rate,
              c.currency, c.billing_rounding, c.is_retainer, c.retainer_hours, c.retainer_monthly_fee, c.overage_rate,
              c.notes, c.is_active, c.created_at
       ORDER BY c.created_at DESC`,
      [user.id]
    );

    const clients = result.rows.map((client) => ({
      id: client.id,
      name: client.name,
      contactName: client.contact_name,
      email: client.email,
      phone: client.phone,
      address: client.address,
      defaultRate: client.default_rate,
      currency: client.currency || "ILS",
      billingRounding: client.billing_rounding,
      isRetainer: client.is_retainer ?? false,
      retainerHours: client.retainer_hours,
      retainerMonthlyFee: client.retainer_monthly_fee,
      overageRate: client.overage_rate,
      notes: client.notes,
      isActive: client.is_active,
      createdAt: client.created_at,
      totalBilled: client.total_billed ? parseFloat(client.total_billed) : 0,
      totalHours: client.total_hours || 0,
    }));

    const { getUserPlan } = await import("@/lib/entitlements");
    const plan = await getUserPlan(user.id);
    const activeCount = clients.filter((c) => c.isActive).length;

    return NextResponse.json(
      {
        success: true,
        clients,
        plan: {
          tier: plan.tier,
          // null = unlimited (Infinity isn't JSON-serializable)
          clientLimit: Number.isFinite(plan.clientLimit) ? plan.clientLimit : null,
          activeCount,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    logger.error("Error fetching clients", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת הלקוחות" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
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

    // Read the plan tier up front; the active-client cap is enforced ATOMICALLY
    // inside the transaction below (per-user advisory lock) to close a TOCTOU race
    // where two concurrent creates could both pass a non-atomic pre-check.
    const { getUserPlan } = await import("@/lib/entitlements");
    const { canAddClient } = await import("@/lib/plans");
    const plan = await getUserPlan(user.id);

    const parsed = await parseBody(request, createClientSchema);
    if (!parsed.ok) return parsed.response;
    const { name, contactName, email, phone, address, defaultRate, currency, billingRounding, isRetainer, retainerHours, retainerMonthlyFee, overageRate, notes, rates } = parsed.data;

    const { query, withTransaction } = await import("@/lib/db");

    // default_rate stays in sync with the default hourly rate (legacy fallback).
    const ratesList = rates ?? [];
    const defaultHourly =
      ratesList.find((r) => r.kind === "hourly" && r.isDefault) ??
      ratesList.find((r) => r.kind === "hourly");
    const effectiveDefaultRate = defaultHourly ? defaultHourly.rate : (defaultRate ?? null);

    // Seed currency from the user's base when the client didn't specify one.
    const profileRow = await query<{ default_currency: string | null }>(
      `SELECT default_currency FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const baseCurrency = profileRow.rows[0]?.default_currency || "ILS";

    // Insert client + rates atomically (RLS GUC bound by withTransaction).
    const result = await withTransaction(async (db) => {
      // Serialize concurrent create/reactivate calls FOR THIS USER on a per-user
      // advisory lock so the COUNT below always sees the prior txn's committed state
      // (different users use different keys and never block each other).
      await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`clients:${user.id}`]);

      const countRes = await db.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM clients WHERE user_id = $1 AND is_active = TRUE",
        [user.id]
      );
      const activeCount = parseInt(countRes.rows[0]?.count ?? "0", 10);
      if (!canAddClient(plan.tier, activeCount)) {
        return { overLimit: true as const };
      }

      const clientResult = await db.query<{
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
        `INSERT INTO clients (id, user_id, name, contact_name, email, phone, address, default_rate, currency, billing_rounding, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate, notes, is_active)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
         RETURNING id, name, contact_name, email, phone, address, default_rate, currency, billing_rounding, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate, notes, is_active, created_at`,
        [
          user.id,
          name.trim(),
          contactName?.trim() || null,
          email?.trim() || null,
          phone?.trim() || null,
          address?.trim() || null,
          effectiveDefaultRate,
          currency || baseCurrency,
          billingRounding ?? null,
          isRetainer ?? false,
          retainerHours || null,
          retainerMonthlyFee || null,
          overageRate || null,
          notes?.trim() || null,
        ]
      );
      const row = clientResult.rows[0];

      if (ratesList.length > 0) {
        // Single multi-row INSERT (one round-trip) instead of N per-rate inserts.
        await db.query(
          `INSERT INTO client_rates (id, user_id, client_id, kind, name, rate, is_default, unit)
           SELECT gen_random_uuid()::text, $1, $2, kind, name, rate, is_default, unit
           FROM unnest($3::text[], $4::text[], $5::numeric[], $6::boolean[], $7::text[])
             AS r(kind, name, rate, is_default, unit)`,
          [
            user.id,
            row.id,
            ratesList.map((r) => r.kind),
            ratesList.map((r) => r.name.trim()),
            ratesList.map((r) => r.rate),
            ratesList.map((r) => (r.kind === "hourly" ? r.isDefault : false)),
            ratesList.map((r) => (r.kind === "item" ? r.unit ?? null : null)),
          ]
        );
      }
      return { overLimit: false as const, client: row };
    });

    if (result.overLimit) {
      return NextResponse.json(
        {
          success: false,
          error_code: "PLAN_LIMIT_REACHED",
          message: "הגעת למגבלת הלקוחות בתוכנית שלך. שדרגו כדי להוסיף לקוחות נוספים.",
        },
        { status: 402 }
      );
    }

    const client = result.client;

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
        billingRounding: client.billing_rounding,
        isRetainer: client.is_retainer ?? false,
        retainerHours: client.retainer_hours,
        retainerMonthlyFee: client.retainer_monthly_fee,
        overageRate: client.overage_rate,
        notes: client.notes,
        isActive: client.is_active,
        createdAt: client.created_at,
      },
    });
  } catch (error) {
    logger.error("Error creating client", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה ביצירת הלקוח" },
      { status: 500 }
    );
  }
}
