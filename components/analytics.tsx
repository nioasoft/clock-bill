"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** Matches a v4-style UUID path segment (our row ids are UUIDs). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strip identifiers and query params from a URL before it reaches Vercel
 * Analytics. App routes can embed client/document ids (and query strings can
 * carry emails or search terms); we keep the route *shape* for useful metrics
 * but never send the PII-bearing parts. See:
 * https://vercel.com/docs/analytics/redacting-sensitive-data
 */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.search = "";
    url.pathname = url.pathname
      .split("/")
      .map((seg) => (UUID_RE.test(seg) || /^\d+$/.test(seg) ? ":id" : seg))
      .join("/");
    return url.toString();
  } catch {
    return raw;
  }
}

/** Cookieless Vercel Analytics + Speed Insights, with URL redaction applied. */
export function AnalyticsScripts() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: redactUrl(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: redactUrl(event.url) })} />
    </>
  );
}
