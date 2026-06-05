"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageSquare, Check, Send } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { fieldClass } from "@/lib/form-styles";
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
} from "@/lib/schemas/feedback";

const MAX_MESSAGE = 5000;

export default function FeedbackPage() {
  const t = useTranslations("Feedback");
  const tCategory = useTranslations("Feedback.category");
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (message.trim().length < 5) {
      setError(t("errors.tooShort"));
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
          // Silently captured so we don't ask users to find their browser/console.
          userAgent:
            typeof navigator !== "undefined"
              ? `${navigator.userAgent} · ${window.innerWidth}×${window.innerHeight}`
              : undefined,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSent(true);
        setMessage("");
      } else {
        setError(data.message || t("errors.submitFailed"));
      }
    } catch {
      setError(t("errors.network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <PageContainer maxWidth="max-w-4xl">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
        />

        {sent ? (
          <div
            className="mt-6 rounded-[var(--radius-card)] border border-border bg-card p-6 motion-safe:animate-fade-up"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-foreground">{t("success.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {t("success.description")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              {t("success.writeAnother")}
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-5 rounded-[var(--radius-card)] border border-border bg-card p-6"
          >
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("fields.category")}
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
                    {tCategory(c)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-foreground">
                {t("fields.message")}
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
                placeholder={t("fields.messagePlaceholder")}
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
              {submitting ? t("submitting") : t("submit")}
            </button>
          </form>
        )}
      </PageContainer>
    </AppLayout>
  );
}
