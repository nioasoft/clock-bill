"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Send, MessageSquare } from "lucide-react";
import { contactSchema } from "@/lib/schemas/contact";
import { Button } from "@/components/ui/button";
import { FieldMessage } from "@/components/ui/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
        <Button
          type="button"
          onClick={() => setSent(false)}
          variant="ghost"
          className="mt-4"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {t("sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[var(--radius-card)] border border-border bg-card p-6"
    >
      <div>
        <Label htmlFor="contact-name">
          {t("nameLabel")} <span className="text-muted-foreground font-normal">{t("nameOptional")}</span>
        </Label>
        <Input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          autoComplete="name"
        />
      </div>

      <div>
        <Label htmlFor="contact-email">
          {t("emailLabel")}
        </Label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError("");
          }}
          required
          dir="ltr"
          className="text-start"
          disabled={submitting}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <Label htmlFor="contact-message">
          {t("messageLabel")}
        </Label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => {
            setMessage(e.target.value.slice(0, MAX_MESSAGE));
            if (error) setError("");
          }}
          rows={6}
          required
          placeholder={t("messagePlaceholder")}
          hasError={Boolean(error)}
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
        <Input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && <FieldMessage variant="error">{error}</FieldMessage>}

      <Button
        type="submit"
        disabled={submitting}
        className="w-full"
        aria-busy={submitting}
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {submitting ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
