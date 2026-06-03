import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";

/** Body schema for creating/updating a currency conversion rate. */
const upsertRateSchema = z.object({
  fromCurrency: z
    .string({ message: "חסרים פרטים - נדרשים מטבע מקור, מטבע יעד ושער" })
    .min(1, "חסרים פרטים - נדרשים מטבע מקור, מטבע יעד ושער")
    .max(10),
  toCurrency: z
    .string({ message: "חסרים פרטים - נדרשים מטבע מקור, מטבע יעד ושער" })
    .min(1, "חסרים פרטים - נדרשים מטבע מקור, מטבע יעד ושער")
    .max(10),
  rate: z
    .number({ message: "שער החליפין חייב להיות מספר חיובי" })
    .positive("שער החליפין חייב להיות מספר חיובי"),
});

/** Body schema for deleting a currency conversion rate. */
const deleteRateSchema = z.object({
  rateId: z.string({ message: "מזהה שער חסר" }).min(1, "מזהה שער חסר"),
});

// GET /api/currency-rates - Get all currency conversion rates for current user
export async function GET(_request: NextRequest) {
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
    }, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600'
      }
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

    const parsed = await parseBody(request, upsertRateSchema);
    if (!parsed.ok) return parsed.response;
    const { fromCurrency, toCurrency, rate } = parsed.data;

    if (fromCurrency === toCurrency) {
      return NextResponse.json(
        { success: false, message: "מטבע המקור ומטבע היעד לא יכולים להיות זהים" },
        { status: 400 }
      );
    }

    // Atomic upsert keyed on the (user_id, from_currency, to_currency) unique
    // constraint — collapses the old read-modify-write (existence check +
    // UPDATE/INSERT + re-SELECT) into a single statement and removes the race.
    const result = await query(
      `INSERT INTO currency_rates (id, user_id, from_currency, to_currency, rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, from_currency, to_currency)
       DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW()
       RETURNING id, user_id, from_currency as "fromCurrency", to_currency as "toCurrency", rate, created_at as "createdAt", updated_at as "updatedAt"`,
      [crypto.randomUUID(), user.id, fromCurrency, toCurrency, rate]
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

    const parsed = await parseBody(request, deleteRateSchema);
    if (!parsed.ok) return parsed.response;
    const { rateId } = parsed.data;

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
