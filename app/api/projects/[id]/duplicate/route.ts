import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * Compute the next free "(העתק)" / "(העתק N)" name for a duplicated project,
 * reproducing the original sequential collision loop without per-candidate
 * round-trips. Given the original name and the set of already-existing names,
 * the candidates are tried in order: "X (העתק)", "X (העתק 2)", "X (העתק 3)", …
 * and the first one not present is returned.
 *
 * @param baseName The original project name (X)
 * @param existingNames All names matching "X (העתק%" already owned by the user
 * @returns The first free copy name in the sequence
 */
function nextCopyName(baseName: string, existingNames: ReadonlySet<string>): string {
  let suffix = 1;
  let candidate = `${baseName} (העתק)`;
  while (existingNames.has(candidate)) {
    suffix++;
    candidate = `${baseName} (העתק ${suffix})`;
  }
  return candidate;
}

/**
 * POST /api/projects/[id]/duplicate
 * Duplicate an existing project
 */
export async function POST(
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

    const { withTransaction } = await import("@/lib/db");
    const { id: projectId } = await params;

    const result = await withTransaction(async (client) => {
      // Get the original project together with its client name (the only joined
      // field needed for the response) and all existing copy-name collisions in
      // a single fetch, so the name-collision check needs zero extra round-trips.
      const originalResult = await client.query<{
        id: string;
        name: string;
        client_id: string;
        client_name: string;
        status: string;
        start_date: string | null;
        end_date: string | null;
        fixed_monthly_enabled: boolean;
        fixed_monthly_fee: number | null;
        fixed_monthly_start_date: string | null;
        fixed_monthly_end_date: string | null;
        notes: string | null;
      }>(
        `SELECT p.id, p.name, p.client_id, c.name as client_name,
                p.status, p.start_date, p.end_date,
                p.fixed_monthly_enabled, p.fixed_monthly_fee, p.fixed_monthly_start_date, p.fixed_monthly_end_date,
                p.notes
         FROM projects p
         JOIN clients c ON p.client_id = c.id
         WHERE p.id = $1 AND p.user_id = $2`,
        [projectId, user.id]
      );

      if (originalResult.rows.length === 0) {
        return { notFound: true as const };
      }

      const original = originalResult.rows[0];

      // Fetch every existing name that could collide with a "(העתק)" copy in one
      // query, then compute the next free suffix in JS (no per-candidate query).
      // Escape LIKE wildcards in the base name so the prefix matches literally;
      // exact membership is verified in JS, so the LIKE only needs to be a superset.
      const likePattern =
        `${original.name.replace(/([\\%_])/g, "\\$1")} (העתק%`;
      const existingResult = await client.query<{ name: string }>(
        `SELECT name FROM projects WHERE user_id = $1 AND name LIKE $2 ESCAPE '\\'`,
        [user.id, likePattern]
      );
      const existingNames = new Set(existingResult.rows.map((r) => r.name));

      // Generate a new name with "(העתק)" suffix (matching the original
      // sequential collision scheme: "(העתק)", "(העתק 2)", "(העתק 3)", …)
      const newName = nextCopyName(original.name, existingNames);

      // Insert the duplicated project (with active status and cleared dates),
      // returning the generated id + created_at so no re-SELECT is needed.
      const insertResult = await client.query<{ id: string; created_at: string }>(
        `INSERT INTO projects (
          id, user_id, client_id, name, status, start_date, end_date,
          fixed_monthly_enabled, fixed_monthly_fee, fixed_monthly_start_date, fixed_monthly_end_date,
          notes
        )
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, created_at`,
        [
          user.id,
          original.client_id,
          newName,
          "active",
          null,
          null,
          original.fixed_monthly_enabled,
          original.fixed_monthly_fee,
          original.fixed_monthly_start_date,
          original.fixed_monthly_end_date,
          original.notes,
        ]
      );

      const inserted = insertResult.rows[0];

      return {
        notFound: false as const,
        project: {
          id: inserted.id,
          name: newName,
          client_id: original.client_id,
          client_name: original.client_name,
          status: "active",
          start_date: null as string | null,
          end_date: null as string | null,
          fixed_monthly_enabled: original.fixed_monthly_enabled,
          fixed_monthly_fee: original.fixed_monthly_fee,
          fixed_monthly_start_date: original.fixed_monthly_start_date,
          fixed_monthly_end_date: original.fixed_monthly_end_date,
          notes: original.notes,
          created_at: inserted.created_at,
        },
      };
    });

    if (result.notFound) {
      return NextResponse.json(
        { success: false, message: "הפרויקט לא נמצא" },
        { status: 404 }
      );
    }

    const project = result.project;

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        clientId: project.client_id,
        clientName: project.client_name,
        status: project.status,
        startDate: project.start_date,
        endDate: project.end_date,
        fixedMonthlyEnabled: project.fixed_monthly_enabled,
        fixedMonthlyFee: project.fixed_monthly_fee,
        fixedMonthlyStartDate: project.fixed_monthly_start_date,
        fixedMonthlyEndDate: project.fixed_monthly_end_date,
        notes: project.notes,
        createdAt: project.created_at,
      },
    });
  } catch (error) {
    console.error("Error duplicating project:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשכפול הפרויקט" },
      { status: 500 }
    );
  }
}
