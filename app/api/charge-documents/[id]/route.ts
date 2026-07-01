import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id");
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { patchChargeDocumentSchema } from "@/lib/schemas/charge-documents";
import { buildLineFromEntry, computeDocumentTotal, type BillableEntry } from "@/lib/charge-documents";
import { resolveRounding } from "@/lib/rounding";
import { recomputeChargeStatus } from "@/lib/charge-documents-server";

type Ctx = { params: Promise<{ id: string }> };

/** GET — document + its lines (ownership enforced). */
export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");

    const doc = await query(
      `SELECT d.*, c.name AS client_name, c.document_language AS client_document_language,
              c.email AS client_email
         FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE d.id = $1 AND d.user_id = $2`,
      [id, user.id]
    );
    if (doc.rowCount === 0) return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });

    const lines = await query(
      `SELECT * FROM charge_document_lines WHERE document_id = $1 AND user_id = $2
        ORDER BY COALESCE(date, to_date(period_month, 'YYYY-MM')) ASC NULLS LAST, created_at`,
      [id, user.id]
    );
    return NextResponse.json({ success: true, data: { document: doc.rows[0], lines: lines.rows } });
  } catch (error) {
    logger.error("GET /api/charge-documents/[id] failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת תעודה" }, { status: 500 });
  }
}

/** PATCH — only when pending: edit notes, edit a line, remove a line, add an entry. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const parsed = await parseBody(request, patchChargeDocumentSchema);
    if (!parsed.ok) return parsed.response;
    const { notes, editLine, removeLineId, addTimeEntryId, summaryMode, showDateRange, discount } = parsed.data;
    const { withTransaction } = await import("@/lib/db");

    const total = await withTransaction(async (client: PoolClient) => {
      const doc = await client.query(
        `SELECT id, client_id, status FROM charge_documents WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, user.id]
      );
      if (doc.rowCount === 0) throw new Error("NOT_FOUND");
      const docStatus: string = doc.rows[0].status;
      if (docStatus !== "pending" && docStatus !== "partial") throw new Error("LOCKED");
      const clientId: string = doc.rows[0].client_id;

      if (typeof notes !== "undefined") {
        await client.query(`UPDATE charge_documents SET notes = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [notes, id, user.id]);
      }

      if (typeof showDateRange !== "undefined") {
        await client.query(`UPDATE charge_documents SET show_date_range = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [showDateRange, id, user.id]);
      }
      if (typeof summaryMode !== "undefined") {
        await client.query(`UPDATE charge_documents SET summary_mode = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [summaryMode, id, user.id]);
      }

      if (typeof discount !== "undefined") {
        await client.query(
          `UPDATE charge_documents SET discount_type = $1, discount_value = $2, updated_at = NOW()
            WHERE id = $3 AND user_id = $4`,
          [discount?.type ?? null, discount?.value ?? null, id, user.id]
        );
      }

      if (editLine) {
        await client.query(
          `UPDATE charge_document_lines SET description = COALESCE($1, description),
             notes = COALESCE($2, notes), updated_at = NOW()
            WHERE id = $3 AND document_id = $4 AND user_id = $5`,
          [editLine.description ?? null, editLine.notes ?? null, editLine.lineId, id, user.id]
        );
      }

      if (removeLineId) {
        const line = await client.query(
          `SELECT time_entry_id FROM charge_document_lines WHERE id = $1 AND document_id = $2 AND user_id = $3`,
          [removeLineId, id, user.id]
        );
        if (line.rowCount === 0) throw new Error("LINE_NOT_FOUND");
        const teId: string | null = line.rows[0].time_entry_id;
        await client.query(`DELETE FROM charge_document_lines WHERE id = $1 AND user_id = $2`, [removeLineId, user.id]);
        if (teId) {
          await client.query(`UPDATE time_entries SET charge_document_id = NULL WHERE id = $1 AND user_id = $2`, [teId, user.id]);
        }
      }

      if (addTimeEntryId) {
        const er = await client.query(
          `SELECT te.id, te.date::text AS "date", te.description, te.notes, te.billing_kind AS "billingKind", te.duration,
                  te.quantity, te.rate, te.rate_label AS "rateLabel", te.item_ref AS "itemRef", te.unit AS "unit",
                  p.name AS "projectName",
                  p.billing_rounding AS "projectRounding",
                  c.billing_rounding AS "clientRounding"
             FROM time_entries te
             JOIN projects p ON te.project_id = p.id
             JOIN clients  c ON p.client_id = c.id
            WHERE te.id = $1 AND te.user_id = $2 AND p.client_id = $3
              AND te.charge_document_id IS NULL AND te.is_billable = true`,
          [addTimeEntryId, user.id, clientId]
        );
        if (er.rowCount === 0) throw new Error("ENTRY_UNAVAILABLE");
        // Resolve the rounding cascade exactly like the POST create path, so a
        // line added via PATCH bills the same rounded minutes as on creation.
        const baseRow = await client.query<{ base: string | null }>(
          `SELECT default_billing_rounding AS base FROM user_profiles WHERE user_id = $1`,
          [user.id]
        );
        const row = er.rows[0] as BillableEntry & {
          projectRounding: string | null;
          clientRounding: string | null;
        };
        const l = buildLineFromEntry({
          ...row,
          billingRounding: resolveRounding(
            row.projectRounding,
            row.clientRounding,
            baseRow.rows[0]?.base ?? null
          ),
        });
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, date, label,
              description, notes, item_ref, billing_kind, quantity, rate, amount, unit, project_name)
           VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [user.id, id, l.sourceType, l.timeEntryId, l.periodMonth, l.date, l.label, l.description,
           l.notes, l.itemRef, l.billingKind, l.quantity, l.rate, l.amount, l.unit, l.projectName]
        );
        await client.query(`UPDATE time_entries SET charge_document_id = $1 WHERE id = $2 AND user_id = $3 AND charge_document_id IS NULL`, [id, addTimeEntryId, user.id]);
      }

      const sum = await client.query(`SELECT amount FROM charge_document_lines WHERE document_id = $1 AND user_id = $2`, [id, user.id]);
      const total = computeDocumentTotal(sum.rows as Array<{ amount: number | null }>);
      await client.query(`UPDATE charge_documents SET total = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [total, id, user.id]);
      await recomputeChargeStatus(client, id, user.id);
      return total;
    });

    return NextResponse.json({ success: true, data: { total } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    if (msg === "LOCKED") return NextResponse.json({ success: false, error_code: "DOCUMENT_LOCKED", message: "התעודה נעולה — בטל תשלום כדי לערוך" }, { status: 409 });
    if (msg === "LINE_NOT_FOUND") return NextResponse.json({ success: false, error_code: "LINE_NOT_FOUND", message: "שורה לא נמצאה" }, { status: 404 });
    if (msg === "ENTRY_UNAVAILABLE") return NextResponse.json({ success: false, error_code: "ENTRY_UNAVAILABLE", message: "הפריט כבר חויב או אינו זמין" }, { status: 409 });
    logger.error("PATCH /api/charge-documents/[id] failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בעדכון תעודה" }, { status: 500 });
  }
}

/** DELETE — only a canceled document (cleanup of a mistake). */
export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");
    const r = await query(
      `DELETE FROM charge_documents WHERE id = $1 AND user_id = $2 AND status = 'canceled' RETURNING id`,
      [id, user.id]
    );
    if (r.rowCount === 0) return NextResponse.json({ success: false, error_code: "DELETE_REQUIRES_CANCELED", message: "ניתן למחוק רק תעודה מבוטלת" }, { status: 409 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("DELETE /api/charge-documents/[id] failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה במחיקת תעודה" }, { status: 500 });
  }
}
