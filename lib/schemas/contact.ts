import { z } from "zod";

/**
 * Public contact form (for logged-out visitors on the landing / legal pages).
 * One Zod schema shared by the client form and the public API route (parsed
 * server-side — frontend validation is not validation). Distinct from the
 * in-app feedback schema, which is auth-gated and category-based.
 */
export const contactSchema = z.object({
  name: z.string().trim().max(100, "השם ארוך מדי").optional(),
  email: z
    .string()
    .trim()
    .min(1, "אנא הזן כתובת אימייל")
    .email("כתובת האימייל אינה תקינה")
    .max(254, "כתובת האימייל ארוכה מדי"),
  message: z
    .string()
    .trim()
    .min(10, "אנא כתוב לפחות כמה מילים")
    .max(5000, "ההודעה ארוכה מדי (עד 5000 תווים)"),
  // Honeypot: a hidden field real users never fill. Bots that auto-fill every
  // input give themselves away. Accepted by the schema (so the request still
  // parses) and dropped server-side when non-empty, so bots get a fake success.
  website: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
