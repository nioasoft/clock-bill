"use client";

import { useEffect, useState } from "react";
import type { AbstractIntlMessages } from "next-intl";
import type { DocumentLanguage } from "@/lib/document-language";

// Module-level cache: a locale's messages bundle is loaded once per session.
const cache = new Map<DocumentLanguage, AbstractIntlMessages>();

async function loadMessages(locale: DocumentLanguage): Promise<AbstractIntlMessages> {
  const cached = cache.get(locale);
  if (cached) return cached;
  // Explicit branches (not a template import) so the bundler code-splits each
  // locale cleanly. Only two locales exist.
  const mod =
    locale === "he"
      ? await import("@/messages/he.json")
      : await import("@/messages/en.json");
  const messages = mod.default as AbstractIntlMessages;
  cache.set(locale, messages);
  return messages;
}

/**
 * Returns the messages bundle for `locale` (the document language), or null
 * until it has loaded. Used to render the print subtree under a nested
 * NextIntlClientProvider in a language different from the UI.
 */
export function useDocumentMessages(locale: DocumentLanguage): AbstractIntlMessages | null {
  const [messages, setMessages] = useState<AbstractIntlMessages | null>(
    () => cache.get(locale) ?? null
  );
  useEffect(() => {
    let active = true;
    void loadMessages(locale).then((m) => {
      if (active) setMessages(m);
    });
    return () => {
      active = false;
    };
  }, [locale]);
  return messages;
}
