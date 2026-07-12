import { createLogger } from "@/lib/logger";
const logger = createLogger("api:public:doc:approve");
import { NextRequest, NextResponse } from "next/server";
import { isValidPublicToken } from "@/lib/public-token";
import { enforceRateLimit, clientIp } from "@/lib/rate-limit";
import { formatCurrency } from "@/lib/currency";

type Ctx = { params: Promise<{ token: string }> };

/**
 * POST — the client approves a charge document via the public no-login page.
 * Auth is the bearer token itself (unguessable, expiring — same predicate as
 * the public page loader). Idempotent: a second click returns success.
 * Notifies the freelancer by email + push, fire-and-forget.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    if (!isValidPublicToken(token)) {
      return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "מסמך לא נמצא" }, { status: 404 });
    }

    const limited = await enforceRateLimit({
      name: "public-doc-approve",
      identifier: clientIp(request),
      limit: 20,
      windowSec: 60 * 60,
    });
    if (limited) return limited;

    const { adminQuery } = await import("@/lib/db");

    const updated = await adminQuery(
      `UPDATE charge_documents
          SET approved_at = NOW(), approved_by = 'client', updated_at = NOW()
        WHERE public_token = $1
          AND public_token_expires_at > NOW()
          AND status IN ('pending', 'partial')
          AND approved_at IS NULL
        RETURNING id, user_id, client_id, doc_number, currency, total, vat_rate_snapshot,
                  discount_type, discount_value, approved_at`,
      [token]
    );

    if (updated.rowCount === 0) {
      const existing = await adminQuery(
        `SELECT status, approved_at FROM charge_documents
          WHERE public_token = $1 AND public_token_expires_at > NOW() AND status <> 'canceled'`,
        [token]
      );
      if (existing.rowCount === 0) {
        return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "מסמך לא נמצא" }, { status: 404 });
      }
      if (existing.rows[0].approved_at) {
        // Double-click / already approved — success, nothing to redo.
        return NextResponse.json({ success: true, data: { approvedAt: existing.rows[0].approved_at, alreadyApproved: true } });
      }
      // Active token but paid — nothing to approve.
      return NextResponse.json({ success: false, error_code: "APPROVE_REQUIRES_ACTIVE", message: "המסמך כבר שולם" }, { status: 409 });
    }

    const doc = updated.rows[0] as {
      id: string; user_id: string; client_id: string; doc_number: number;
      currency: string; total: number | null; vat_rate_snapshot: number | null;
      discount_type: "percent" | "amount" | null; discount_value: number | null;
      approved_at: string;
    };

    await adminQuery(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
       VALUES (gen_random_uuid()::text, $1, 'charge_document.client_approved', 'charge_document', $2, $3)`,
      [doc.user_id, doc.id, JSON.stringify({ docNumber: doc.doc_number, via: "public_link" })]
    );

    // Notify the freelancer — never fail the client's approval over it.
    notifyOwner(doc).catch((error) => logger.error("approve notification failed:", error));

    return NextResponse.json({ success: true, data: { approvedAt: doc.approved_at } });
  } catch (error) {
    logger.error("POST public approve failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה באישור המסמך" }, { status: 500 });
  }
}

/** Email + push to the document owner: "client X approved document #N". */
async function notifyOwner(doc: {
  id: string; user_id: string; client_id: string; doc_number: number;
  currency: string; total: number | null; vat_rate_snapshot: number | null;
  discount_type: "percent" | "amount" | null; discount_value: number | null;
}): Promise<void> {
  const { adminQuery } = await import("@/lib/db");
  const { rows } = await adminQuery(
    `SELECT u.email AS user_email, p.locale, c.name AS client_name
       FROM "user" u
       JOIN clients c ON c.id = $2
  LEFT JOIN user_profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [doc.user_id, doc.client_id]
  );
  if (rows.length === 0) return;
  const { user_email, locale, client_name } = rows[0] as {
    user_email: string; locale: string | null; client_name: string;
  };
  const loc: "he" | "en" = locale === "en" ? "en" : "he";

  const { documentMoney } = await import("@/lib/charge-documents");
  const { gross } = documentMoney({
    total: doc.total ?? 0,
    discountType: doc.discount_type,
    discountValue: doc.discount_value,
    vatRate: doc.vat_rate_snapshot,
  });
  const amountLabel = formatCurrency(gross, doc.currency, loc);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
  const localePrefix = loc === "en" ? "/en" : "";
  const documentUrl = `${appUrl}${localePrefix}/reports?tab=documents`;

  const { sendEmail } = await import("@/lib/email");
  const { chargeDocumentApprovedEmail } = await import("@/lib/emails/charge-document-approved");
  const { subject, html } = chargeDocumentApprovedEmail(loc, {
    clientName: client_name,
    docNumber: doc.doc_number,
    amountLabel,
    documentUrl,
  });

  const { sendPushToUser } = await import("@/lib/push");
  const pushCopy =
    loc === "en"
      ? { title: `Document #${doc.doc_number} approved`, body: `${client_name} approved the charge document (${amountLabel}).` }
      : { title: `תעודה #${doc.doc_number} אושרה`, body: `${client_name} אישר את תעודת ההתחשבנות (${amountLabel}).` };

  await Promise.all([
    sendEmail({ to: user_email, subject, html }),
    sendPushToUser(doc.user_id, {
      ...pushCopy,
      url: "/reports?tab=documents",
      tag: `doc-approved-${doc.id}`,
      lang: loc,
    }),
  ]);
}
