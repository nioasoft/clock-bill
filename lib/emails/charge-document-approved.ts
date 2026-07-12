/**
 * Bilingual notification emailed to the freelancer when a client approves a
 * charge document via the public /doc/[token] page: "client X approved
 * document #N" + a CTA to the document. Sent by the public approve route.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";

/** Escape user-controlled text before embedding in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function chargeDocumentApprovedEmail(
  locale: EmailLocale,
  p: { clientName: string; docNumber: number; amountLabel: string; documentUrl: string }
): { subject: string; html: string } {
  if (locale === "en") {
    return {
      subject: `${p.clientName} approved document #${p.docNumber}`,
      html: emailLayout({
        locale: "en",
        heading: `Document #${p.docNumber} approved`,
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>${esc(p.clientName)}</strong> approved charge document #${p.docNumber} (${esc(p.amountLabel)}).</p>` +
          `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">The document is now locked for editing and awaiting payment.</p>` +
          emailButton(p.documentUrl, "Open document"),
      }),
    };
  }
  return {
    subject: `${p.clientName} אישר את תעודה #${p.docNumber}`,
    html: emailLayout({
      locale: "he",
      heading: `תעודה #${p.docNumber} אושרה`,
      bodyHtml:
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;"><strong>${esc(p.clientName)}</strong> אישר את תעודת ההתחשבנות #${p.docNumber} (${esc(p.amountLabel)}).</p>` +
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;">התעודה נעולה כעת לעריכה וממתינה לתשלום.</p>` +
        emailButton(p.documentUrl, "פתח את התעודה"),
    }),
  };
}
