/**
 * Bilingual digest emailed to the freelancer on a client's settlement day:
 * "you have N settlements ready" + the client list + a dashboard CTA. Sent by
 * the notifications cron once per cycle. See spec 2026-06-21-settlement-reminders.
 */
import { emailLayout, emailButton, type EmailLocale } from "@/lib/email";

export interface SettlementReminderClient {
  name: string;
  amountLabel: string;
}

/** Escape user-controlled text before embedding in email HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function listHtml(clients: SettlementReminderClient[]): string {
  const items = clients
    .map(
      (c) =>
        `<li style="margin:0 0 6px;font-size:15px;line-height:1.6;">${esc(c.name)} — <strong>${esc(c.amountLabel)}</strong></li>`
    )
    .join("");
  return `<ul style="padding-inline-start:20px;margin:0 0 16px;">${items}</ul>`;
}

export function settlementReminderEmail(
  locale: EmailLocale,
  p: { clients: SettlementReminderClient[]; dashboardUrl: string }
): { subject: string; html: string } {
  const n = p.clients.length;
  if (locale === "en") {
    return {
      subject: `You have ${n} settlement${n === 1 ? "" : "s"} ready`,
      html: emailLayout({
        locale: "en",
        heading: `${n} settlement${n === 1 ? "" : "s"} ready`,
        bodyHtml:
          `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">These clients have reached their settlement day and have unbilled work:</p>` +
          listHtml(p.clients) +
          emailButton(p.dashboardUrl, "Open dashboard"),
      }),
    };
  }
  return {
    subject: `יש לך ${n} התחשבנויות לביצוע`,
    html: emailLayout({
      locale: "he",
      heading: `${n} התחשבנויות לביצוע`,
      bodyHtml:
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;">הלקוחות הבאים הגיעו למועד ההתחשבנות ויש להם עבודה לא מחויבת:</p>` +
        listHtml(p.clients) +
        emailButton(p.dashboardUrl, "פתח את הדאשבורד"),
    }),
  };
}
