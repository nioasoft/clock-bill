import { NextRequest, NextResponse } from "next/server";
import { sendEmail, emailLayout } from "@/lib/email";
import { contactSchema } from "@/lib/schemas/contact";

/** Where public contact messages are delivered. Overridable via env. */
const CONTACT_RECIPIENT =
  process.env.CONTACT_TO || process.env.FEEDBACK_TO || "benatia.asaf@gmail.com";

/**
 * Best-effort, per-IP rate limit. There is no Upstash/Redis in this project, so
 * this lives in module memory: it slows abuse from a single warm instance but
 * does not survive cold starts or span instances. The honeypot is the primary
 * spam defense; this is a cheap second layer.
 */
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_WINDOW;
}

/** Escape user-supplied text before embedding it in the email HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/contact
 * Public endpoint (no auth) for the landing / legal contact form. Validates,
 * drops honeypot hits silently, and emails the owner via Resend with reply-to
 * set to the sender so replies go straight back.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error_code: "RATE_LIMIT", message: "נשלחו יותר מדי הודעות. נסה שוב מאוחר יותר." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error_code: "INVALID_REQUEST", message: "בקשה לא תקינה" }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "נתונים לא תקינים";
    return NextResponse.json({ success: false, error_code: "VALIDATION_ERROR", message }, { status: 400 });
  }

  const { name, email, message, website } = parsed.data;

  // Honeypot tripped: pretend success so bots don't learn to adapt.
  if (website) {
    return NextResponse.json({ success: true });
  }

  const sent = await sendEmail({
    to: CONTACT_RECIPIENT,
    replyTo: email,
    subject: `[מוניט · צור קשר] הודעה מ-${email}`,
    html: emailLayout({
      heading: "הודעה חדשה מטופס יצירת הקשר",
      bodyHtml: `
        ${name ? `<p style="margin:0 0 4px;font-size:14px;color:#71717a;">שם: ${escapeHtml(name)}</p>` : ""}
        <p style="margin:0 0 4px;font-size:14px;color:#71717a;">אימייל: <span dir="ltr">${escapeHtml(email)}</span></p>
        <p style="margin:12px 0 0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</p>`,
    }),
  });

  if (!sent) {
    return NextResponse.json(
      { success: false, error_code: "EMAIL_SEND_FAILED", message: "שליחת ההודעה נכשלה. נסה שוב מאוחר יותר." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
