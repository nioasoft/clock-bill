import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api-reports-presets");

/** Body schema for creating a report preset. */
const createPresetSchema = z.object({
  name: z.string({ message: "שם הפריסט הוא שדה חובה" }).min(1, "שם הפריסט הוא שדה חובה").max(500),
  clientId: z.string().nullish(),
  projectId: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
});

// GET - Fetch all report presets for the current user
export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מאומת" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Fetch all presets for the user
    const result = await query(
      `
      SELECT id, name, client_id, project_id, start_date, end_date, created_at, updated_at
      FROM report_presets
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    const presets = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      clientId: row.client_id,
      projectId: row.project_id,
      startDate: row.start_date,
      endDate: row.end_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json({
      success: true,
      presets,
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });
  } catch (error) {
    logger.error("Error fetching report presets", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בטעינת הפריסטים" },
      { status: 500 }
    );
  }
}

// POST - Create a new report preset
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "לא מאומת" },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Parse request body
    const parsed = await parseBody(req, createPresetSchema);
    if (!parsed.ok) return parsed.response;
    const { name, clientId, projectId, startDate, endDate } = parsed.data;

    // Generate new ID
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Insert new preset
    await query(
      `
      INSERT INTO report_presets (id, user_id, name, client_id, project_id, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [id, userId, name, clientId || null, projectId || null, startDate || null, endDate || null]
    );

    // Fetch the created preset
    const result = await query(
      `
      SELECT id, name, client_id, project_id, start_date, end_date, created_at, updated_at
      FROM report_presets
      WHERE id = $1
      `,
      [id]
    );

    const preset = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      clientId: result.rows[0].client_id,
      projectId: result.rows[0].project_id,
      startDate: result.rows[0].start_date,
      endDate: result.rows[0].end_date,
      createdAt: result.rows[0].created_at,
      updatedAt: result.rows[0].updated_at,
    };

    return NextResponse.json({
      success: true,
      preset,
      message: "הפריסט נשמר בהצלחה",
    });
  } catch (error) {
    logger.error("Error creating report preset", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשמירת הפריסט" },
      { status: 500 }
    );
  }
}
