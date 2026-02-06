import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

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
      notes: string | null;
      is_active: boolean;
      created_at: string;
    }>(
      `SELECT id, name, contact_name, email, phone, address, default_rate, notes, is_active, created_at
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

    const body = await request.json();
    const { name, contactName, email, phone, address, defaultRate, notes } = body;
    const { id: clientId } = await params;

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

    // Verify ownership and update client
    await query(
      `UPDATE clients
       SET name = $1, contact_name = $2, email = $3, phone = $4, address = $5, default_rate = $6, notes = $7
       WHERE id = $8 AND user_id = $9`,
      [
        name.trim(),
        contactName?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        address?.trim() || null,
        defaultRate || null,
        notes?.trim() || null,
        clientId,
        user.id,
      ]
    );

    // Check if client exists and belongs to user
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

    // Fetch the updated client
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
    console.error("Error updating client:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בעדכון הלקוח" },
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
