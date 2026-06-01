import { z } from "zod";

/**
 * Beta feedback / bug-report form. One Zod schema shared by the client form and
 * the API route (parsed server-side — frontend validation is not validation).
 */
export const FEEDBACK_CATEGORIES = ["bug", "suggestion", "question", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const CATEGORY_LABELS_HE: Record<FeedbackCategory, string> = {
  bug: "תקלה / באג",
  suggestion: "הצעה לשיפור",
  question: "שאלה",
  other: "אחר",
};

export const feedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z
    .string()
    .trim()
    .min(5, "אנא כתוב לפחות כמה מילים")
    .max(5000, "ההודעה ארוכה מדי (עד 5000 תווים)"),
  // The page the user was on when reporting — helps reproduce bugs.
  pageUrl: z.string().max(500).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
