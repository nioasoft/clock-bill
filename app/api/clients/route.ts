import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

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
  isRetainer: z.boolean().nullish(),
  retainerHours: z.number().nullish(),
  retainerMonthlyFee: z.number().nullish(),
  overageRate: z.number().nullish(),
  notes: z.string().max(5000).nullish(),
});

/**
 * GET /api/clients
 * List all clients for the authenticated user
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
              c.currency, c.is_retainer, c.retainer_hours, c.retainer_monthly_fee, c.overage_rate,
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
              c.currency, c.is_retainer, c.retainer_hours, c.retainer_monthly_fee, c.overage_rate,
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

    // Add cache headers for better performance
    // Cache for 60 seconds since client list doesn't change that often
    return NextResponse.json({
      success: true,
      clients,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הלקוחות" },
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
        { success: false, message: "לא מחובר" },
        { status: 401 }
      );
    }

    const parsed = await parseBody(request, createClientSchema);
    if (!parsed.ok) return parsed.response;
    const { name, contactName, email, phone, address, defaultRate, currency, isRetainer, retainerHours, retainerMonthlyFee, overageRate, notes } = parsed.data;

    const { query } = await import("@/lib/db");

    // Insert client with inline UUID, returning all fields
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
      `INSERT INTO clients (id, user_id, name, contact_name, email, phone, address, default_rate, currency, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate, notes, is_active)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE)
       RETURNING id, name, contact_name, email, phone, address, default_rate, currency, is_retainer, retainer_hours, retainer_monthly_fee, overage_rate, notes, is_active, created_at`,
      [
        user.id,
        name.trim(),
        contactName?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        address?.trim() || null,
        defaultRate || null,
        currency || "ILS",
        isRetainer ?? false,
        retainerHours || null,
        retainerMonthlyFee || null,
        overageRate || null,
        notes?.trim() || null,
      ]
    );

    const client = clientResult.rows[0];

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
      },
    });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה ביצירת הלקוח" },
      { status: 500 }
    );
  }
}
