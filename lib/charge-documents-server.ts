/**
 * Server-only charge-document helpers that touch the DB. Kept out of
 * lib/charge-documents.ts so that module stays pure & unit-testable.
 */
import type { PoolClient } from "pg";
import { documentMoney, paymentStatus, type DiscountType } from "./charge-documents";

/**
 * Recompute and persist a document's derived status (`pending` | `partial` |
 * `paid`) and `paid_at` from its payment journal vs the gross owed. Must run
 * inside a transaction; the caller is expected to have locked the document row
 * (`SELECT ... FOR UPDATE`). No-op for canceled documents.
 */
export async function recomputeChargeStatus(
  client: PoolClient,
  documentId: string,
  userId: string
): Promise<void> {
  const bal = await documentBalance(client, documentId, userId);
  if (!bal || bal.docStatus === "canceled") return;
  const status = paymentStatus(bal.gross, bal.paidSum);
  const paidAt = status === "paid" ? bal.lastPaid : null;

  await client.query(
    `UPDATE charge_documents SET status = $1, paid_at = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4`,
    [status, paidAt, documentId, userId]
  );
}

/** Gross owed vs paid for a document; `excludePaymentId` previews a payment edit. */
export async function documentBalance(
  client: PoolClient,
  documentId: string,
  userId: string,
  excludePaymentId: string | null = null
): Promise<{ docStatus: string; gross: number; paidSum: number; lastPaid: string | null } | null> {
  const docRes = await client.query(
    `SELECT total, discount_type, discount_value, vat_rate_snapshot, status
       FROM charge_documents WHERE id = $1 AND user_id = $2`,
    [documentId, userId]
  );
  if (docRes.rowCount === 0) return null;
  const d = docRes.rows[0] as {
    total: number | null;
    discount_type: DiscountType | null;
    discount_value: number | null;
    vat_rate_snapshot: number | null;
    status: string;
  };
  const payRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS paid_sum, MAX(paid_at) AS last_paid
       FROM charge_document_payments
      WHERE document_id = $1 AND user_id = $2 AND ($3::text IS NULL OR id <> $3)`,
    [documentId, userId, excludePaymentId]
  );
  const paidSum = Number(payRes.rows[0]?.paid_sum ?? 0);
  const lastPaid = payRes.rows[0]?.last_paid ?? null;

  const { gross } = documentMoney({
    total: d.total ?? 0,
    discountType: d.discount_type,
    discountValue: d.discount_value,
    vatRate: d.vat_rate_snapshot,
  });
  return { docStatus: d.status, gross, paidSum, lastPaid };
}
