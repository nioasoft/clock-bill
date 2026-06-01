"use client";

import { useState } from "react";
import { MessageSquare, CheckCircle2, Send } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { fieldClass } from "@/lib/form-styles";
import {
  FEEDBACK_CATEGORIES,
  CATEGORY_LABELS_HE,
  type FeedbackCategory,
} from "@/lib/schemas/feedback";

const MAX_MESSAGE = 5000;

export default function FeedbackPage() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (message.trim().length < 5) {
      setError("אנא כתוב לפחות כמה מילים");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          // The page the user came from, for reproducing bugs.
          pageUrl: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSent(true);
        setMessage("");
      } else {
        setError(data.message || "שליחת הפנייה נכשלה. נסה שוב.");
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer maxWidth="max-w-4xl">
        <PageHeader
          title="פניות ודיווח תקלות"
          subtitle="מצאת באג? יש לך הצעה לשיפור? המערכת בתקופת ניסוי — נשמח לשמוע ממך."
        />

        {sent ? (
          <div
            className="mt-6 rounded-[var(--radius-card)] border border-success/30 bg-success/5 p-6 text-center motion-safe:animate-fade-up"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h3 className="mt-3 font-display text-xl font-semibold text-foreground">הפנייה נשלחה — תודה!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              נחזור אליך במייל אם נצטרך פרטים נוספים.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              שלח פנייה נוספת
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5 rounded-[var(--radius-card)] border border-border bg-card p-6"
          >
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
                סוג הפנייה
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                className={fieldClass(false)}
                disabled={submitting}
              >
                {FEEDBACK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS_HE[c]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-foreground">
                תיאור
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value.slice(0, MAX_MESSAGE));
                  if (error) setError("");
                }}
                rows={6}
                required
                placeholder="ספר לנו מה קרה, מה ציפית שיקרה, ואיך אפשר לשחזר..."
                className={`${fieldClass(Boolean(error))} resize-y`}
                disabled={submitting}
                aria-describedby="message-count"
              />
              <div id="message-count" className="mt-1 text-end text-xs text-muted-foreground tabular-nums">
                {message.length}/{MAX_MESSAGE}
              </div>
            </div>

            {error && (
              <div className="rounded-[var(--radius)] bg-destructive/10 p-3" role="alert">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || message.trim().length < 5}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
              {submitting ? "שולח..." : "שלח פנייה"}
            </button>
          </form>
        )}
      </PageContainer>
    </AppLayout>
  );
}
