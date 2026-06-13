import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createChargeDocumentSchema } from "@/lib/schemas/charge-documents";
import { buildLineFromEntry, computeDocumentTotal, type BillableEntry, type ChargeLineDraft } from "@/lib/charge-documents";
import { resolveRounding } from "@/lib/rounding";
import { createLogger } from "@/lib/logger";

const logger = createLogger("charge-documents:list");

/** GET /api/charge-documents?clientId=&status= — list documents for the user. */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    const { query } = await import("@/lib/db");
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");
    const status = searchParams.get("status");

    const params: (string | number)[] = [user.id];
    let where = "d.user_id = $1";
    if (clientId) { params.push(clientId); where += ` AND d.client_id = $${params.length}`; }
    if (status)   { params.push(status);   where += ` AND d.status = $${params.length}`; }

    const rows = await query(
      `SELECT d.id, d.doc_number, d.status, d.currency, d.total, d.issued_at, d.paid_at,
              d.canceled_at, c.name AS client_name
         FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE ${where}
        ORDER BY d.doc_number DESC`,
      params
    );
    return NextResponse.json({ success: true, data: rows.rows });
  } catch (error) {
    logger.error("GET /api/charge-documents failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת תעודות" }, { status: 500 });
  }
}

/** POST /api/charge-documents — issue a new settlement document. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });

    const parsed = await parseBody(request, createChargeDocumentSchema);
    if (!parsed.ok) return parsed.response;
    const { clientId, pdfTemplate, notes, timeEntryIds, computedLines } = parsed.data;

    const { withTransaction } = await import("@/lib/db");

    const result = await withTransaction(async (client: PoolClient) => {
      const clientRow = await client.query(
        `SELECT currency FROM clients WHERE id = $1 AND user_id = $2`,
        [clientId, user.id]
      );
      if (clientRow.rowCount === 0) throw new Error("CLIENT_NOT_FOUND");
      const currency: string = clientRow.rows[0].currency ?? "ILS";

      // Profile-level billing base (cascade's lowest tier). Read once; used as
      // the rounding fallback when neither project nor client sets a mode.
      const profileBaseRow = await client.query(
        `SELECT default_billing_rounding FROM user_profiles WHERE user_id = $1`,
        [user.id]
      );
      const baseRounding: string | null = profileBaseRow.rows[0]?.default_billing_rounding ?? null;

      let entries: BillableEntry[] = [];
      if (timeEntryIds.length > 0) {
        const er = await client.query(
          `SELECT te.id, te.description, te.notes, te.billing_kind AS "billingKind",
                  te.duration, te.quantity, te.rate, te.rate_label AS "rateLabel",
                  te.unit AS "unit",
                  te.item_ref AS "itemRef",
                  p.billing_rounding AS "projectRounding",
                  c.billing_rounding AS "clientRounding"
             FROM time_entries te
             JOIN projects p ON te.project_id = p.id
             JOIN clients  c ON p.client_id = c.id
            WHERE te.id = ANY($1::text[]) AND te.user_id = $2 AND p.client_id = $3
              AND te.charge_document_id IS NULL AND te.is_billable = true`,
          [timeEntryIds, user.id, clientId]
        );
        entries = er.rows.map((row) => ({
          ...(row as BillableEntry),
          billingRounding: resolveRounding(
            (row as { projectRounding: string | null }).projectRounding,
            (row as { clientRounding: string | null }).clientRounding,
            baseRounding
          ),
        }));
        if (entries.length !== timeEntryIds.length) throw new Error("ENTRY_STATE_CHANGED");
      }

      const entryLines: ChargeLineDraft[] = entries.map(buildLineFromEntry);
      const computedDrafts: ChargeLineDraft[] = computedLines.map((c) => ({
        sourceType: c.sourceType,
        timeEntryId: null,
        periodMonth: c.periodMonth,
        label: c.label,
        description: null,
        notes: null,
        itemRef: null,
        billingKind: "fixed",
        quantity: null,
        unit: null,
        rate: null,
        amount: c.amount,
      }));
      const allLines = [...entryLines, ...computedDrafts];
      const total = computeDocumentTotal(allLines);

      const counter = await client.query(
        `INSERT INTO user_profiles (id, user_id, next_charge_doc_number)
         VALUES (gen_random_uuid()::text, $1, 2)
         ON CONFLICT (user_id) DO UPDATE
           SET next_charge_doc_number = user_profiles.next_charge_doc_number + 1
         RETURNING next_charge_doc_number - 1 AS doc_number`,
        [user.id]
      );
      const docNumber: number = counter.rows[0].doc_number;

      const doc = await client.query(
        `INSERT INTO charge_documents
           (id, user_id, client_id, doc_number, status, currency, total, notes, pdf_template, issued_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, 'pending', $4, $5, $6, $7, NOW())
         RETURNING id, doc_number`,
        [user.id, clientId, docNumber, currency, total, notes ?? null, pdfTemplate]
      );
      const documentId: string = doc.rows[0].id;

      if (allLines.length > 0) {
        // Single multi-row INSERT via unnest() — one round-trip for N lines.
        // id is generated per row in SQL; user_id/document_id are scalars repeated for every row.
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, label,
              description, notes, item_ref, billing_kind, quantity, rate, amount, unit)
           SELECT gen_random_uuid()::text, $1, $2, t.source_type, t.time_entry_id, t.period_month,
                  t.label, t.description, t.notes, t.item_ref, t.billing_kind, t.quantity, t.rate, t.amount, t.unit
             FROM unnest(
               $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
               $8::text[], $9::int[], $10::text[], $11::numeric[], $12::numeric[], $13::numeric[], $14::text[]
             ) AS t(source_type, time_entry_id, period_month, label, description,
                    notes, item_ref, billing_kind, quantity, rate, amount, unit)`,
          [
            user.id,
            documentId,
            allLines.map((l) => l.sourceType),
            allLines.map((l) => l.timeEntryId),
            allLines.map((l) => l.periodMonth),
            allLines.map((l) => l.label),
            allLines.map((l) => l.description),
            allLines.map((l) => l.notes),
            allLines.map((l) => l.itemRef),
            allLines.map((l) => l.billingKind),
            allLines.map((l) => l.quantity),
            allLines.map((l) => l.rate),
            allLines.map((l) => l.amount),
            allLines.map((l) => l.unit),
          ]
        );
      }

      if (entries.length > 0) {
        await client.query(
          `UPDATE time_entries SET charge_document_id = $1
            WHERE id = ANY($2::text[]) AND user_id = $3 AND charge_document_id IS NULL`,
          [documentId, entries.map((e) => e.id), user.id]
        );
      }

      return { id: documentId, docNumber: doc.rows[0].doc_number };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "CLIENT_NOT_FOUND") return NextResponse.json({ success: false, error_code: "CLIENT_NOT_FOUND", message: "לקוח לא נמצא" }, { status: 404 });
    if (msg === "ENTRY_STATE_CHANGED") return NextResponse.json({ success: false, error_code: "ENTRY_STATE_CHANGED", message: "חלק מהפריטים כבר חויבו או השתנו — רענן ונסה שוב" }, { status: 409 });
    logger.error("POST /api/charge-documents failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה ביצירת תעודה" }, { status: 500 });
  }
}
