/**
 * Bilingual email sent to a freelancer's client linking to the branded
 * charge-document view. Sent from the verified clock-bill.com sender; replies
 * are routed to the freelancer via reply-to (resolveReplyTo). See spec
 * 2026-06-21-charge-document-email.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";

export interface ChargeDocumentEmailParams {
  businessName: string;
  clientName: string;
  docNumber: number;
  /** Pre-formatted gross amount, e.g. "₪1,170.00" (built by the caller). */
  amountLabel: string;
  url: string;
}

/** Escape user-controlled text before embedding it in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function chargeDocumentEmail(
  locale: EmailLocale,
  p: ChargeDocumentEmailParams
): { subject: string; html: string } {
  const business = esc(p.businessName);
  const client = esc(p.clientName);
  const amount = esc(p.amountLabel);

  if (locale === "en") {
    return {
      subject: `Statement #${p.docNumber} from ${p.businessName}`,
      html: emailLayout({
        locale: "en",
        heading: `Statement #${p.docNumber}`,
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">Hi ${client},</p>` +
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${business} has sent you a statement for ${amount}.</p>` +
          `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;">You can view and print it here:</p>` +
          emailButton(p.url, "View statement") +
          `<p style="margin:12px 0 0;font-size:13px;color:#71717a;">Reply to this email to reach ${business} directly.</p>`,
      }),
    };
  }

  return {
    subject: `התחשבנות מס' ${p.docNumber} מאת ${p.businessName}`,
    html: emailLayout({
      locale: "he",
      heading: `התחשבנות מס' ${p.docNumber}`,
      bodyHtml:
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">שלום ${client},</p>` +
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${business} שלח/ה לך התחשבנות על סך ${amount}.</p>` +
        `<p style="margin:0 0 4px;font-size:15px;line-height:1.6;">ניתן לצפות ולהדפיס כאן:</p>` +
        emailButton(p.url, "צפייה בהתחשבנות") +
        `<p style="margin:12px 0 0;font-size:13px;color:#71717a;">ניתן להשיב למייל זה כדי ליצור קשר ישירות עם ${business}.</p>`,
    }),
  };
}

/** Reply-to = the freelancer's business email, falling back to their account email. */
export function resolveReplyTo(
  profileEmail: string | null | undefined,
  accountEmail: string
): string {
  const p = profileEmail?.trim();
  return p && p.length > 0 ? p : accountEmail;
}
