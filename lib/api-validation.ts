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
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "גוף הבקשה אינו תקין" },
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
        { success: false, message: firstMessage },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
