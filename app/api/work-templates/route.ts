import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { createWorkTemplateSchema } from "@/lib/schemas/work-templates";

const logger = createLogger("api:work-templates");

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED" }, { status: 401 });
    const result = await query(
      `SELECT wt.id, wt.client_id AS "clientId", wt.project_id AS "projectId",
              wt.rate_id AS "rateId", wt.title, wt.description, wt.notes,
              wt.billing_kind AS "billingKind", wt.duration, wt.quantity,
              wt.rate, wt.rate_label AS "rateLabel", wt.unit,
              wt.is_billable AS "isBillable", p.name AS "projectName", c.name AS "clientName"
         FROM work_templates wt
         JOIN projects p ON p.id = wt.project_id AND p.user_id = $1
         JOIN clients c ON c.id = wt.client_id AND c.user_id = $1
        WHERE wt.user_id = $1
        ORDER BY wt.updated_at DESC
        LIMIT 50`,
      [user.id]
    );
    return NextResponse.json({ success: true, templates: result.rows });
  } catch (error) {
    logger.error("GET /api/work-templates failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED" }, { status: 401 });
    const parsed = createWorkTemplateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error_code: "VALIDATION_ERROR" }, { status: 400 });
    }
    const input = parsed.data;
    const ownership = await query<{ valid: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM projects p JOIN clients c ON c.id = p.client_id
          WHERE p.id = $2 AND c.id = $3 AND p.user_id = $1 AND c.user_id = $1
       ) AS valid`,
      [user.id, input.projectId, input.clientId]
    );
    if (!ownership.rows[0]?.valid) {
      return NextResponse.json({ success: false, error_code: "NOT_FOUND" }, { status: 404 });
    }
    const id = randomUUID();
    const result = await query(
      `INSERT INTO work_templates
        (id, user_id, client_id, project_id, rate_id, title, description, notes,
         billing_kind, duration, quantity, rate, rate_label, unit, is_billable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id, title`,
      [id, user.id, input.clientId, input.projectId, input.rateId ?? null, input.title,
       input.description, input.notes ?? null, input.billingKind, input.duration ?? null,
       input.quantity ?? null, input.rate ?? null, input.rateLabel ?? null, input.unit ?? null,
       input.isBillable]
    );
    return NextResponse.json({ success: true, template: result.rows[0] }, { status: 201 });
  } catch (error) {
    logger.error("POST /api/work-templates failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR" }, { status: 500 });
  }
}
