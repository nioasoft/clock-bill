/**
 * Email verification API endpoint
 * Verifies email using a token from the verification link
 */
import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export interface VerifyEmailResponse {
  success: boolean;
  message?: string;
}

/**
 * GET handler - verify email with token from link
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<NextResponse> {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Invalid verification link" },
        { status: 400 }
      );
    }

    // Find valid token
    const tokenResult = await query<{
      id: string;
      user_id: string;
      expires_at: string;
      used: boolean;
    }>(
      `SELECT id, user_id, expires_at, used
       FROM email_verification_tokens
       WHERE token = $1`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Invalid verification link" },
        { status: 400 }
      );
    }

    const tokenData = tokenResult.rows[0];

    // Check if token is already used
    if (tokenData.used) {
      return NextResponse.json({
        success: true,
        message: "Email already verified",
      });
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(tokenData.expires_at);
    if (now > expiresAt) {
      return NextResponse.json(
        { success: false, message: "Verification link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark token as used
    await query(
      `UPDATE email_verification_tokens SET used = TRUE WHERE id = $1`,
      [tokenData.id]
    );

    // Mark user email as verified
    await query(
      `UPDATE users SET email_verified = TRUE, updated_at = NOW() WHERE id = $1`,
      [tokenData.user_id]
    );

    console.log(`✅ Email verified for user ${tokenData.user_id}`);

    // Return HTML page with success message
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>אימות אימייל - שעון</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 2rem 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            text-align: center;
            max-width: 400px;
          }
          .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 1.5rem;
            line-height: 1.5;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 500;
            transition: background 0.2s;
          }
          .button:hover {
            background: #5568d3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✅</div>
          <h1>האימייל אומת בהצלחה!</h1>
          <p>כתובת האימייל שלך אומתה בהצלחה. אתה יכול כעת להמשיך להשתמש במערכת.</p>
          <a href="/" class="button">מעבר לדשבורד</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Email verification error:", error);

    const errorHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>שגיאה באימות - שעון</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 2rem 3rem;
            border-radius: 1rem;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            text-align: center;
            max-width: 400px;
          }
          .icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          h1 {
            color: #1f2937;
            margin-bottom: 0.5rem;
            font-size: 1.5rem;
          }
          p {
            color: #6b7280;
            margin-bottom: 1.5rem;
            line-height: 1.5;
          }
          .button {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 500;
            transition: background 0.2s;
          }
          .button:hover {
            background: #5568d3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">❌</div>
          <h1>אירעה שגיאה</h1>
          <p>לא ניתן היה לאמת את כתובת האימייל. ייתכן שהקישור פג תוקף. אנא בקש קישור חדש.</p>
          <a href="/" class="button">מעבר לדשבורד</a>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
