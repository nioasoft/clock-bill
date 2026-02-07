import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
      notes: string | null;
      is_active: boolean;
      created_at: string;
      total_billed: string | null;
      total_hours: number | null;
    }>(
      `SELECT c.id, c.name, c.contact_name, c.email, c.phone, c.address, c.default_rate, c.notes, c.is_active, c.created_at,
              COALESCE(SUM(
                CASE
                  WHEN te.is_billable = TRUE THEN
                    COALESCE(p.hourly_rate, c.default_rate, 0) * (te.duration / 60.0)
                  ELSE 0
                END
              ), 0) as total_billed,
              COALESCE(SUM(te.duration), 0) / 60.0 as total_hours
       FROM clients c
       LEFT JOIN projects p ON p.client_id = c.id
       LEFT JOIN time_entries te ON te.project_id = p.id
       WHERE c.user_id = $1
       GROUP BY c.id, c.name, c.contact_name, c.email, c.phone, c.address, c.default_rate, c.notes, c.is_active, c.created_at
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

    const body = await request.json();
    const { name, contactName, email, phone, address, defaultRate, notes } = body;

    // Validation
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "יש להזין שם לקוח" },
        { status: 400 }
      );
    }

    if (name.length > 200) {
      return NextResponse.json(
        { success: false, message: "שם הלקוח ארוך מדי (מקסימום 200 תווים)" },
        { status: 400 }
      );
    }

    if (email && email.length > 200) {
      return NextResponse.json(
        { success: false, message: "כתובת האימייל ארוכה מדי" },
        { status: 400 }
      );
    }

    if (phone && phone.length > 50) {
      return NextResponse.json(
        { success: false, message: "מספר הטלפון ארוך מדי" },
        { status: 400 }
      );
    }

    if (address && address.length > 500) {
      return NextResponse.json(
        { success: false, message: "הכתובת ארוכה מדי (מקסימום 500 תווים)" },
        { status: 400 }
      );
    }

    if (defaultRate !== undefined && defaultRate !== null && defaultRate < 0) {
      return NextResponse.json(
        { success: false, message: "התעריף השעתי לא יכול להיות שלילי" },
        { status: 400 }
      );
    }

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
      notes: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `INSERT INTO clients (id, user_id, name, contact_name, email, phone, address, default_rate, notes, is_active)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING id, name, contact_name, email, phone, address, default_rate, notes, is_active, created_at`,
      [
        user.id,
        name.trim(),
        contactName?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        address?.trim() || null,
        defaultRate || null,
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
