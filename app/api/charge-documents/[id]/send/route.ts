import { createLogger } from "@/lib/logger";
const logger = createLogger("api:charge-documents:id:send");
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { chargeDocumentEmail, resolveReplyTo } from "@/lib/emails/charge-document";
import { generatePublicToken } from "@/lib/public-token";
import { formatCurrency } from "@/lib/currency";
import { resolveDocumentLocale } from "@/lib/document-language";

type Ctx = { params: Promise<{ id: string }> };

/** POST — email this charge document to its client as a branded link. */
export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
    }
    const { id } = await ctx.params;
    const { query } = await import("@/lib/db");

    // Load the document + client email + the document/client language settings.
    const docRes = await query(
      `SELECT d.id, d.doc_number, d.status, d.currency, d.total, d.vat_rate_snapshot,
              d.public_token, d.document_language,
              c.name AS client_name, c.email AS client_email, c.document_language AS client_doc_language
         FROM charge_documents d
         JOIN clients c ON d.client_id = c.id
        WHERE d.id = $1 AND d.user_id = $2`,
      [id, user.id]
    );
    if (docRes.rowCount === 0) {
      return NextResponse.json({ success: false, error_code: "DOCUMENT_NOT_FOUND", message: "תעודה לא נמצאה" }, { status: 404 });
    }
    const doc = docRes.rows[0] as {
      id: string; doc_number: number; status: string; currency: string; total: number | null;
      vat_rate_snapshot: number | null; public_token: string | null; document_language: string | null;
      client_name: string; client_email: string | null; client_doc_language: string | null;
    };

    if (doc.status === "canceled") {
      return NextResponse.json({ success: false, error_code: "SEND_REQUIRES_ACTIVE", message: "לא ניתן לשלוח מסמך מבוטל" }, { status: 409 });
    }
    const to = doc.client_email?.trim();
    if (!to) {
      return NextResponse.json({ success: false, error_code: "CLIENT_HAS_NO_EMAIL", message: "ללקוח אין כתובת מייל — הוסף כתובת בפרטי הלקוח" }, { status: 422 });
    }

    // Freelancer's business profile (reply-to source + business name).
    const profRes = await query(
      `SELECT business_name, email FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const prof = profRes.rows[0] as { business_name?: string; email?: string } | undefined;
    const businessName: string = prof?.business_name || user.email;
    const replyTo = resolveReplyTo(prof?.email, user.email);

    // Resolve the document's language (snapshot → else client setting → else by currency).
    const docLocale = resolveDocumentLocale(
      (doc.document_language as "he" | "en" | null) ?? (doc.client_doc_language as "he" | "en" | null),
      doc.currency
    );

    // Gross amount the client owes (net + VAT). `total` is the NET subtotal.
    const net = doc.total ?? 0;
    const gross = doc.vat_rate_snapshot ? net * (1 + doc.vat_rate_snapshot / 100) : net;
    const amountLabel = formatCurrency(gross, doc.currency, docLocale);

    // Lazily mint the public token.
    const token = doc.public_token ?? generatePublicToken();
    if (!doc.public_token) {
      await query(`UPDATE charge_documents SET public_token = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [token, id, user.id]);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.clock-bill.com";
    const localePrefix = docLocale === "en" ? "/en" : "";
    const url = `${appUrl}${localePrefix}/doc/${token}`;

    const { subject, html } = chargeDocumentEmail(docLocale, {
      businessName,
      clientName: doc.client_name,
      docNumber: doc.doc_number,
      amountLabel,
      url,
    });

    const ok = await sendEmail({ to, subject, html, replyTo });
    if (!ok) {
      return NextResponse.json({ success: false, error_code: "EMAIL_SEND_FAILED", message: "שליחת המייל נכשלה — נסה שוב" }, { status: 502 });
    }

    const sentAt = new Date().toISOString();
    await query(`UPDATE charge_documents SET last_sent_at = NOW(), sent_to_email = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [to, id, user.id]);

    // Append-only audit row (privileged path — the tenant role cannot write audit_events).
    const { adminQuery } = await import("@/lib/db");
    await adminQuery(
      `INSERT INTO audit_events (id, actor_id, action, target_type, target_id, metadata)
       VALUES (gen_random_uuid()::text, $1, 'charge_document.sent', 'charge_document', $2, $3)`,
      [user.id, id, JSON.stringify({ to, docNumber: doc.doc_number })]
    );

    return NextResponse.json({ success: true, sentTo: to, sentAt, token });
  } catch (error) {
    logger.error("POST send failed:", error);
    return NextResponse.json({ success: false, error_code: "SERVER_ERROR", message: "שגיאה בשליחת המסמך" }, { status: 500 });
  }
}
