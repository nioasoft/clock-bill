import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";

// GET /api/currency-rates - Get all currency conversion rates for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    // Get all rates for this user
    const result = await query(
      `SELECT id, user_id, from_currency as "fromCurrency", to_currency as "toCurrency", rate, created_at as "createdAt", updated_at as "updatedAt"
       FROM currency_rates
       WHERE user_id = $1
       ORDER BY from_currency, to_currency`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      rates: result.rows,
    });
  } catch (error) {
    console.error("Error fetching currency rates:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת שערי חליפין" },
      { status: 500 }
    );
  }
}

// POST /api/currency-rates - Create or update currency conversion rate
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const body = await request.json();
    const { fromCurrency, toCurrency, rate } = body;

    // Validate input
    if (!fromCurrency || !toCurrency || !rate) {
      return NextResponse.json(
        { success: false, message: "חסרים פרטים - נדרשים מטבע מקור, מטבע יעד ושער" },
        { status: 400 }
      );
    }

    if (fromCurrency === toCurrency) {
      return NextResponse.json(
        { success: false, message: "מטבע המקור ומטבע היעד לא יכולים להיות זהים" },
        { status: 400 }
      );
    }

    if (typeof rate !== "number" || rate <= 0) {
      return NextResponse.json(
        { success: false, message: "שער החליפין חייב להיות מספר חיובי" },
        { status: 400 }
      );
    }

    // Check if rate already exists
    const existing = await query(
      `SELECT id FROM currency_rates WHERE user_id = $1 AND from_currency = $2 AND to_currency = $3`,
      [user.id, fromCurrency, toCurrency]
    );

    let rateId;

    if (existing.rows.length > 0) {
      // Update existing rate
      rateId = existing.rows[0].id;
      await query(
        `UPDATE currency_rates SET rate = $1, updated_at = NOW() WHERE id = $2`,
        [rate, rateId]
      );
    } else {
      // Create new rate
      rateId = crypto.randomUUID();
      await query(
        `INSERT INTO currency_rates (id, user_id, from_currency, to_currency, rate) VALUES ($1, $2, $3, $4, $5)`,
        [rateId, user.id, fromCurrency, toCurrency, rate]
      );
    }

    // Return the created/updated rate
    const result = await query(
      `SELECT id, user_id, from_currency as "fromCurrency", to_currency as "toCurrency", rate, created_at as "createdAt", updated_at as "updatedAt"
       FROM currency_rates
       WHERE id = $1`,
      [rateId]
    );

    return NextResponse.json({
      success: true,
      rate: result.rows[0],
    });
  } catch (error) {
    console.error("Error saving currency rate:", error);

    // Check if table doesn't exist error
    if (error && typeof error === "object" && "code" in error && error.code === "42P01") {
      return NextResponse.json(
        { success: false, message: "טבלת שערי חליפין אינה קיימת. יש ליצור אותה תחילה." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, message: "שגיאה בשמירת שער חליפין" },
      { status: 500 }
    );
  }
}

// DELETE /api/currency-rates - Delete a currency conversion rate
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
    }

    const body = await request.json();
    const { rateId } = body;

    if (!rateId) {
      return NextResponse.json(
        { success: false, message: "מזהה שער חסר" },
        { status: 400 }
      );
    }

    // Verify ownership and delete
    const result = await query(
      `DELETE FROM currency_rates WHERE id = $1 AND user_id = $2 RETURNING id`,
      [rateId, user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "שער חליפין לא נמצא" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "שער החליפין נמחק בהצלחה",
    });
  } catch (error) {
    console.error("Error deleting currency rate:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה במחיקת שער חליפין" },
      { status: 500 }
    );
  }
}
