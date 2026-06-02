import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createChargeDocumentSchema } from "@/lib/schemas/charge-documents";
import { buildLineFromEntry, computeDocumentTotal, type BillableEntry, type ChargeLineDraft } from "@/lib/charge-documents";
import { resolveRounding } from "@/lib/rounding";

/** GET /api/charge-documents?clientId=&status= — list documents for the user. */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });
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
    console.error("GET /api/charge-documents failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה בטעינת תעודות" }, { status: 500 });
  }
}

/** POST /api/charge-documents — issue a new settlement document. */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ success: false, message: "לא מחובר" }, { status: 401 });

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

      let entries: BillableEntry[] = [];
      if (timeEntryIds.length > 0) {
        const er = await client.query(
          `SELECT te.id, te.description, te.notes, te.billing_kind AS "billingKind",
                  te.duration, te.quantity, te.rate, te.rate_label AS "rateLabel",
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
            (row as { clientRounding: string | null }).clientRounding
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

      for (const l of allLines) {
        await client.query(
          `INSERT INTO charge_document_lines
             (id, user_id, document_id, source_type, time_entry_id, period_month, label,
              description, notes, item_ref, billing_kind, quantity, rate, amount)
           VALUES (gen_random_uuid()::text, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [user.id, documentId, l.sourceType, l.timeEntryId, l.periodMonth, l.label,
           l.description, l.notes, l.itemRef, l.billingKind, l.quantity, l.rate, l.amount]
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
    if (msg === "CLIENT_NOT_FOUND") return NextResponse.json({ success: false, message: "לקוח לא נמצא" }, { status: 404 });
    if (msg === "ENTRY_STATE_CHANGED") return NextResponse.json({ success: false, message: "חלק מהפריטים כבר חויבו או השתנו — רענן ונסה שוב" }, { status: 409 });
    console.error("POST /api/charge-documents failed:", error);
    return NextResponse.json({ success: false, message: "שגיאה ביצירת תעודה" }, { status: 500 });
  }
}
