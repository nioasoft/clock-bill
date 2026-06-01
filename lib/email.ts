/**
 * Email sending via Resend.
 *
 * One thin wrapper used by every outbound email (password reset, email
 * verification, beta feedback). Reads RESEND_API_KEY and EMAIL_FROM from the
 * environment. If RESEND_API_KEY is missing (e.g. local dev without a key),
 * sending is skipped and the message is logged instead of throwing — callers
 * (auth hooks) must never crash a flow just because email is unconfigured.
 *
 * Required prod env: RESEND_API_KEY, EMAIL_FROM (a verified Resend sender,
 * e.g. "מוניט <noreply@clock-bill.com>" — the domain must be verified in Resend).
 */
import { Resend } from "resend";
import { createLogger } from "@/lib/logger";

const logger = createLogger("email");

const DEFAULT_FROM = "מוניט <noreply@clock-bill.com>";

let client: Resend | null = null;

/** Lazy Resend client — null when no API key is configured. */
function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  /** Where replies should go — used by the feedback form (reply to the user). */
  replyTo?: string;
}

/**
 * Send one email. Returns whether it was sent. Never throws — logs failures so
 * auth flows degrade gracefully instead of breaking on a transient mail error.
 */
export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams): Promise<boolean> {
  const resend = getResend();
  if (!resend) {
    logger.warn(`RESEND_API_KEY missing — skipping email to ${to} ("${subject}")`);
    return false;
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  try {
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      logger.error(`Resend rejected email to ${to} ("${subject}")`, error);
      return false;
    }
    return true;
  } catch (error) {
    logger.error(`Failed to send email to ${to} ("${subject}")`, error);
    return false;
  }
}

/**
 * Wrap body content in a consistent RTL, Hebrew, light-theme email shell.
 * Emails render in third-party clients, so this stays inline-styled and light
 * (not the app's dark theme).
 */
export function emailLayout(opts: { heading: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
            <tr>
              <td style="background-color:#0a0a0a;padding:20px 28px;">
                <span style="color:#faff69;font-size:22px;font-weight:bold;">מוניט</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#18181b;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#18181b;">${opts.heading}</h1>
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;">
                הודעה זו נשלחה ממוניט — מערכת מעקב שעות עבודה.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** Primary call-to-action button (inline-styled for email clients). */
export function emailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="border-radius:8px;background-color:#faff69;">
        <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#0a0a0a;text-decoration:none;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`;
}
