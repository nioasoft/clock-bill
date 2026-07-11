import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { entryDate } from "@/lib/schemas/entries";
import { CSV_IMPORT_BATCH_SIZE } from "@/lib/csv-entry-import";
import { createLogger } from "@/lib/logger";

const logger = createLogger("entries:import");

const importEntrySchema = z.object({
  projectId: z.string().trim().min(1),
  date: entryDate,
  duration: z.number().int().min(1).max(24 * 60),
  description: z.string().trim().min(1).max(5000),
  notes: z.string().trim().max(5000).nullable(),
  isBillable: z.boolean(),
  rate: z.number().min(0).max(1_000_000).nullable(),
});

const importEntriesSchema = z.object({
  entries: z
    .array(importEntrySchema)
    .min(1, "יש לבחור לפחות רשומה אחת")
    .max(CSV_IMPORT_BATCH_SIZE, `ניתן לייבא עד ${CSV_IMPORT_BATCH_SIZE} רשומות בכל פעולה`),
});

type ImportedEntry = z.infer<typeof importEntrySchema>;

async function insertEntry(client: PoolClient, userId: string, entry: ImportedEntry) {
  // Keep the timestamp and reporting date coherent for imported historical work.
  // Noon UTC avoids crossing the selected calendar day in supported time zones.
  const startTime = new Date(`${entry.date}T12:00:00.000Z`);
  const endTime = new Date(startTime.getTime() + entry.duration * 60 * 1000);
  const result = await client.query<{ id: string }>(
    `INSERT INTO time_entries
       (id, user_id, project_id, description, start_time, end_time, duration, date,
        notes, is_billable, billing_kind, rate, tags)
     VALUES
       (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, 'hourly', $10, '[]'::jsonb)
     RETURNING id`,
    [
      userId,
      entry.projectId,
      entry.description,
      startTime.toISOString(),
      endTime.toISOString(),
      entry.duration,
      entry.date,
      entry.notes,
      entry.isBillable,
      entry.rate,
    ]
  );
  return result.rows[0].id;
}

/**
 * POST /api/entries/import
 * Atomically creates only the CSV rows explicitly approved in the review UI.
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

    const { enforceRateLimit } = await import("@/lib/rate-limit");
    const limited = await enforceRateLimit({
      name: "entries-import",
      identifier: user.id,
      limit: 10,
      windowSec: 60,
    });
    if (limited) return limited;

    const parsed = await parseBody(request, importEntriesSchema);
    if (!parsed.ok) return parsed.response;

    const { getLockedClientIds, lockedClientResponse } = await import("@/lib/plan-guard");
    const lockedClientIds = await getLockedClientIds(user.id);
    const projectIds = [...new Set(parsed.data.entries.map((entry) => entry.projectId))];
    const { withTransaction } = await import("@/lib/db");

    const outcome = await withTransaction(async (client) => {
      const ownedProjects = await client.query<{ id: string; client_id: string }>(
        `SELECT p.id, p.client_id
           FROM projects p
           JOIN clients c ON c.id = p.client_id
          WHERE p.id = ANY($1::text[])
            AND p.user_id = $2
            AND c.user_id = $2`,
        [projectIds, user.id]
      );
      if (ownedProjects.rows.length !== projectIds.length) return { projectInvalid: true as const };
      if (ownedProjects.rows.some((project) => lockedClientIds.has(project.client_id))) {
        return { planLocked: true as const };
      }

      const ids: string[] = [];
      for (const entry of parsed.data.entries) {
        ids.push(await insertEntry(client, user.id, entry));
      }
      return { ids };
    });

    if ("projectInvalid" in outcome) {
      return NextResponse.json(
        { success: false, error_code: "PROJECT_NOT_FOUND", message: "אחד הפרויקטים לא נמצא" },
        { status: 404 }
      );
    }
    if ("planLocked" in outcome) return lockedClientResponse();

    return NextResponse.json({
      success: true,
      importedCount: outcome.ids.length,
      entryIds: outcome.ids,
    });
  } catch (error) {
    logger.error("Error importing entries", error);
    return NextResponse.json(
      { success: false, error_code: "SERVER_ERROR", message: "שגיאה בייבוא הרשומות" },
      { status: 500 }
    );
  }
}
