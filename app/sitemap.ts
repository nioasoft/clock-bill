import type { MetadataRoute } from "next";

/**
 * XML sitemap (served at /sitemap.xml) for the public marketing/auth routes.
 *
 * Locale strategy (next-intl, localePrefix "as-needed"):
 *   - Hebrew (default) is prefix-less:  https://host/login
 *   - English is prefixed:              https://host/en/login
 * Each entry lists both language variants via `alternates.languages` so search
 * engines surface the right locale per user. Authenticated app routes
 * (dashboard, clients, …) are intentionally excluded — they're behind auth and
 * carry no SEO value.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.clock-bill.com";

/** Public, indexable routes (paths relative to the locale root). */
const PUBLIC_ROUTES = [
  "",
  "login",
  "register",
  "privacy",
  "terms",
  "accessibility",
  "contact",
] as const;

/** Build an absolute URL for a route + optional locale prefix. */
function url(path: string, prefix = ""): string {
  const segment = [prefix, path].filter(Boolean).join("/");
  return segment ? `${BASE_URL}/${segment}` : BASE_URL;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((path) => {
    const heUrl = url(path); // Hebrew: prefix-less
    const enUrl = url(path, "en"); // English: /en prefix

    return {
      url: heUrl,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: {
          he: heUrl,
          en: enUrl,
        },
      },
    };
  });
}
