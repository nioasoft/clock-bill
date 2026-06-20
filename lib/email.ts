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
 * e.g. "ClockBill <noreply@clock-bill.com>" — the domain must be verified in Resend).
 */
import { Resend } from "resend";
import { createLogger } from "@/lib/logger";

const logger = createLogger("email");

const DEFAULT_FROM = "ClockBill <noreply@clock-bill.com>";

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

/** Supported email locales. Recipient locale is resolved best-effort by callers. */
export type EmailLocale = "he" | "en";

/** Brand name per locale ("ClockBill" is a single Latin word-mark in every locale). */
const EMAIL_BRAND: Record<EmailLocale, string> = {
  he: "ClockBill",
  en: "ClockBill",
};

/** Footer line per locale. */
const EMAIL_FOOTER: Record<EmailLocale, string> = {
  he: "הודעה זו נשלחה מ-ClockBill — מערכת מעקב שעות עבודה.",
  en: "This message was sent by ClockBill — a work-hours tracking system.",
};

/**
 * Wrap body content in a consistent, light-theme email shell.
 * Emails render in third-party clients, so this stays inline-styled and light
 * (not the app's dark theme). The locale sets `<html lang/dir>`, text direction,
 * the brand label, and the footer line — defaults to Hebrew/RTL for back-compat.
 */
/** Escape text for safe embedding in HTML/email (text or double-quoted attr). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function emailLayout(opts: {
  heading: string;
  bodyHtml: string;
  locale?: EmailLocale;
}): string {
  const locale = opts.locale ?? "he";
  const isRtl = locale === "he";
  const dir = isRtl ? "rtl" : "ltr";
  const align = isRtl ? "right" : "left";
  const brand = EMAIL_BRAND[locale];
  const footer = EMAIL_FOOTER[locale];

  return `<!DOCTYPE html>
<html lang="${locale}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir}" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center" style="text-align:center;">
          <table role="presentation" align="center" width="520" cellpadding="0" cellspacing="0" dir="${dir}" style="width:100%;max-width:520px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;text-align:${align};">
            <tr>
              <td style="background-color:#0a0a0a;padding:20px 28px;">
                <span style="color:#faff69;font-size:22px;font-weight:bold;">${brand}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;color:#18181b;">
                <h1 style="margin:0 0 16px;font-size:20px;color:#18181b;">${escapeHtml(opts.heading)}</h1>
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;border-top:1px solid #e4e4e7;color:#71717a;font-size:12px;">
                ${footer}
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
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:bold;color:#0a0a0a;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}
