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

    // Get all clients for this user
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
    }>(
      `SELECT id, name, contact_name, email, phone, address, default_rate, notes, is_active, created_at
       FROM clients
       WHERE user_id = $1
       ORDER BY created_at DESC`,
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

    // Generate UUID for new client
    const clientIdResult = await query<{ id: string }>(
      `SELECT gen_random_uuid()::text as id`
    );
    const clientId = clientIdResult.rows[0].id;

    // Insert client
    await query(
      `INSERT INTO clients (id, user_id, name, contact_name, email, phone, address, default_rate, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)`,
      [
        clientId,
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

    // Fetch the created client
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
