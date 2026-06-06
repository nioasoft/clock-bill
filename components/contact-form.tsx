"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Send, MessageSquare } from "lucide-react";
import { fieldClass } from "@/lib/form-styles";
import { contactSchema } from "@/lib/schemas/contact";

const MAX_MESSAGE = 5000;

/**
 * Public contact form for logged-out visitors (landing / legal pages). Posts to
 * the public /api/contact endpoint. Handles all four states: empty (the form),
 * loading (submitting), success, and error. The `website` field is a hidden
 * honeypot for spam.
 */
export function ContactForm() {
  const t = useTranslations("Contact.form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate client-side for fast feedback; the server re-validates.
    const result = contactSchema.safeParse({ name, email, message, website });
    if (!result.success) {
      setError(result.error.issues[0]?.message || t("errorFix"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });
      const data = await response.json();
      if (data.success) {
        setSent(true);
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setError(data.message || t("errorSend"));
      }
    } catch {
      setError(t("errorNetwork"));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div
        className="rounded-[var(--radius-card)] border border-border bg-card p-6 motion-safe:animate-fade-up"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15">
            <Check className="h-4 w-4 text-success" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">{t("successHeading")}</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {t("successBody")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          {t("sendAnother")}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[var(--radius-card)] border border-border bg-card p-6"
    >
      <div>
        <label htmlFor="contact-name" className="mb-1.5 block text-sm font-medium text-foreground">
          {t("nameLabel")} <span className="text-muted-foreground font-normal">{t("nameOptional")}</span>
        </label>
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass(false)}
          disabled={submitting}
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="mb-1.5 block text-sm font-medium text-foreground">
          {t("emailLabel")}
        </label>
        <input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          required
          dir="ltr"
          className={`${fieldClass(false)} text-start`}
          disabled={submitting}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-1.5 block text-sm font-medium text-foreground">
          {t("messageLabel")}
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value.slice(0, MAX_MESSAGE));
            if (error) setError("");
          }}
          rows={6}
          required
          placeholder={t("messagePlaceholder")}
          className={`${fieldClass(Boolean(error))} resize-y`}
          disabled={submitting}
          aria-describedby="contact-count"
        />
        <div id="contact-count" className="mt-1 text-end text-xs text-muted-foreground tabular-nums">
          {message.length}/{MAX_MESSAGE}
        </div>
      </div>

      {/* Honeypot: visually hidden, off-screen, not announced to screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">{t("honeypotLabel")}</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius)] bg-destructive/10 p-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="h-4 w-4" />
        {submitting ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
