import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { sendEmail, emailLayout } from "@/lib/email";
import { feedbackSchema, CATEGORY_LABELS_HE } from "@/lib/schemas/feedback";

/** Where beta feedback is delivered. Overridable via env without a redeploy. */
const FEEDBACK_RECIPIENT = process.env.FEEDBACK_TO || "benatia.asaf@gmail.com";

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
 * POST /api/feedback
 * Authenticated users send beta feedback / bug reports; emailed to the owner
 * via Resend with reply-to set to the user so replies go straight back.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ success: false, error_code: "UNAUTHORIZED", message: "לא מחובר" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error_code: "INVALID_REQUEST", message: "בקשה לא תקינה" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "נתונים לא תקינים";
    return NextResponse.json({ success: false, error_code: "VALIDATION_ERROR", message }, { status: 400 });
  }

  const { category, message, pageUrl, userAgent } = parsed.data;
  const categoryLabel = CATEGORY_LABELS_HE[category];

  const sent = await sendEmail({
    to: FEEDBACK_RECIPIENT,
    replyTo: user.email,
    subject: `[מוניט · ${categoryLabel}] פנייה מ-${user.email}`,
    html: emailLayout({
      heading: `פנייה חדשה — ${escapeHtml(categoryLabel)}`,
      bodyHtml: `
        <p style="margin:0 0 4px;font-size:14px;color:#71717a;">מאת: <span dir="ltr">${escapeHtml(user.email)}</span></p>
        ${pageUrl ? `<p style="margin:0 0 4px;font-size:14px;color:#71717a;">עמוד: <span dir="ltr">${escapeHtml(pageUrl)}</span></p>` : ""}
        <p style="margin:12px 0 0;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</p>
        ${userAgent ? `<p style="margin:16px 0 0;padding-top:12px;border-top:1px solid #e4e4e7;font-size:12px;color:#a1a1aa;" dir="ltr">${escapeHtml(userAgent)}</p>` : ""}`,
    }),
  });

  if (!sent) {
    return NextResponse.json(
      { success: false, error_code: "EMAIL_SEND_FAILED", message: "שליחת הפנייה נכשלה. נסה שוב מאוחר יותר." },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
