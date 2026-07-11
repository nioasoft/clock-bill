import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getUser } from "@/lib/auth";
import { parseBody } from "@/lib/api-validation";
import { createLogger } from "@/lib/logger";
import { documentMoney, outstanding, type DiscountType } from "@/lib/charge-documents";
import { recomputeChargeStatus } from "@/lib/charge-documents-server";
import { applyReconciliationSchema } from "@/lib/schemas/payment-reconciliation";

const logger = createLogger("api:payment-reconciliation");

async function rateLimit(userId: string, name: string, limit: number) {
  const { enforceRateLimit } = await import("@/lib/rate-limit");
  return enforceRateLimit({ name, identifier: userId, limit, windowSec: 60 });
}

interface CandidateRow extends Record<string, unknown> {
  id: string;
  doc_number: number;
  issued_at: Date | null;
  currency: string;
  total: number | null;
  discount_type: DiscountType | null;
  discount_value: number | null;
  vat_rate_snapshot: number | null;
  client_name: string;
  paid_sum: number;
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const limited = await rateLimit(user.id, "payment-reconciliation-read", 60);
    if (limited) return limited;
    const { query } = await import("@/lib/db");
    const result = await query<CandidateRow>(
      `SELECT d.id, d.doc_number, d.issued_at, d.currency, d.total,
              d.discount_type, d.discount_value, d.vat_rate_snapshot,
              c.name AS client_name,
              COALESCE(SUM(p.amount), 0)::float8 AS paid_sum
         FROM charge_documents d
         JOIN clients c ON c.id = d.client_id AND c.user_id = $1
         LEFT JOIN charge_document_payments p
           ON p.document_id = d.id AND p.user_id = $1
        WHERE d.user_id = $1 AND d.status IN ('pending', 'partial')
        GROUP BY d.id, c.name
        ORDER BY d.issued_at DESC NULLS LAST, d.created_at DESC
        LIMIT 250`,
      [user.id]
    );

    const documents = result.rows.flatMap((row) => {
      const { gross } = documentMoney({
        total: row.total ?? 0,
        discountType: row.discount_type,
        discountValue: row.discount_value,
        vatRate: row.vat_rate_snapshot,
      });
      const open = outstanding(gross, Number(row.paid_sum));
      if (open <= 0) return [];
      return [{
        id: row.id,
        documentNumber: row.doc_number,
        clientName: row.client_name,
        issuedAt: row.issued_at,
        currency: row.currency || "ILS",
        outstanding: open,
      }];
    });

    return NextResponse.json({ success: true, data: { documents } });
  } catch (error) {
    logger.error("GET reconciliation candidates failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בטעינת תעודות פתוחות" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const limited = await rateLimit(user.id, "payment-reconciliation-write", 10);
    if (limited) return limited;
    const parsed = await parseBody(request, applyReconciliationSchema);
    if (!parsed.ok) return parsed.response;
    const { withTransaction } = await import("@/lib/db");

    const result = await withTransaction(async (client: PoolClient) => {
      let applied = 0;
      let skipped = 0;

      for (const match of parsed.data.matches) {
        const duplicate = await client.query(
          `SELECT id FROM charge_document_payments
            WHERE user_id = $1 AND reconciliation_key = $2`,
          [user.id, match.reconciliationKey]
        );
        if (duplicate.rowCount) {
          skipped += 1;
          continue;
        }

        const document = await client.query<{
          status: string;
          total: number | null;
          discount_type: DiscountType | null;
          discount_value: number | null;
          vat_rate_snapshot: number | null;
        }>(
          `SELECT status, total, discount_type, discount_value, vat_rate_snapshot
             FROM charge_documents
            WHERE id = $1 AND user_id = $2
            FOR UPDATE`,
          [match.documentId, user.id]
        );
        if (!document.rowCount) throw new Error("DOCUMENT_NOT_FOUND");
        if (document.rows[0].status === "canceled") throw new Error("DOCUMENT_CANCELED");

        const paymentTotal = await client.query<{ paid_sum: number }>(
          `SELECT COALESCE(SUM(amount), 0)::float8 AS paid_sum
             FROM charge_document_payments
            WHERE document_id = $1 AND user_id = $2`,
          [match.documentId, user.id]
        );
        const row = document.rows[0];
        const { gross } = documentMoney({
          total: row.total ?? 0,
          discountType: row.discount_type,
          discountValue: row.discount_value,
          vatRate: row.vat_rate_snapshot,
        });
        const open = outstanding(gross, Number(paymentTotal.rows[0]?.paid_sum ?? 0));
        if (match.amount > open + 0.005) throw new Error("AMOUNT_EXCEEDS_OUTSTANDING");

        const inserted = await client.query(
          `INSERT INTO charge_document_payments
             (id, user_id, document_id, amount, paid_at, method, note, reconciliation_key)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, reconciliation_key)
             WHERE reconciliation_key IS NOT NULL DO NOTHING`,
          [user.id, match.documentId, match.amount, match.paidAt, match.method, match.note ?? null, match.reconciliationKey]
        );
        if (!inserted.rowCount) {
          skipped += 1;
          continue;
        }
        await recomputeChargeStatus(client, match.documentId, user.id);
        applied += 1;
      }
      return { applied, skipped };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ success: false, error_code: message, message: "אחת התעודות לא נמצאה" }, { status: 404 });
    }
    if (message === "DOCUMENT_CANCELED") {
      return NextResponse.json({ success: false, error_code: message, message: "אחת התעודות בוטלה" }, { status: 409 });
    }
    if (message === "AMOUNT_EXCEEDS_OUTSTANDING") {
      return NextResponse.json({ success: false, error_code: message, message: "הסכום גבוה מהיתרה הפתוחה" }, { status: 409 });
    }
    logger.error("POST reconciliation failed", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שמירת ההתאמות נכשלה" }, { status: 500 });
  }
}
