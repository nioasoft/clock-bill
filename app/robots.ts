import type { MetadataRoute } from "next";

/**
 * robots.txt (served at /robots.txt). Allow public crawling but keep the
 * authenticated app surface + API out of the index, and point crawlers at the
 * sitemap. Host/sitemap derive from NEXT_PUBLIC_APP_URL.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.clock-bill.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Non-public surfaces — no SEO value, behind auth or programmatic.
      disallow: [
        "/api/",
        "/dashboard",
        "/entries",
        "/clients",
        "/projects",
        "/tasks",
        "/reports",
        "/settings",
        "/admin",
        "/feedback",
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
