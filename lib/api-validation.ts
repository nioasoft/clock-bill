import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * Backend validation is mandatory (frontend validation is only UX): a client can
 * craft any payload via DevTools, so every route that reads a body must validate
 * it server-side. On failure returns a ready 400 `NextResponse` with a Hebrew
 * message; on success returns the typed, validated data.
 *
 * Usage:
 *   const parsed = await parseBody(request, schema);
 *   if (!parsed.ok) return parsed.response;
 *   const { name, email } = parsed.data;
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  // `error_code` keeps the failure shape consistent with every route
  // (`{ success, error_code, message }`) so the client's messageForError() can
  // localize it. `message` is retained as the legacy/specific fallback — note
  // the client prefers error_code, so it sees the generic localized string; the
  // specific Zod message is fine to lose here because client-side validation is
  // the primary gate and this only fires on a bypassed/drifted payload.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error_code: "VALIDATION_ERROR", message: "גוף הבקשה אינו תקין" },
        { status: 400 }
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const firstMessage = parsed.error.issues[0]?.message || "נתונים לא תקינים";
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error_code: "VALIDATION_ERROR", message: firstMessage },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
