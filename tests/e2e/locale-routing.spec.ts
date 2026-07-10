import { test, expect } from "@playwright/test";
import { STR } from "./i18n-strings";

/**
 * Locks down the next-intl `localePrefix: "as-needed"` contract:
 *   - Hebrew (default) is prefix-less: `/`, `/login`, `/terms`.
 *   - English is prefixed:            `/en`, `/en/login`, `/en/terms`.
 *   - <html lang/dir> reflects the active locale (he→rtl, en→ltr).
 *   - Translated strings render per locale (asserted against the catalogs).
 *   - The NEXT_LOCALE cookie (set by the locale switcher) preserves the path
 *     while swapping the locale.
 *   - The auth proxy redirects unauthenticated users to login, keeping the
 *     locale prefix.
 *   - sitemap.xml / robots.txt expose both locales correctly.
 *
 * All of these are deterministic and require no authentication.
 */

test.describe("html lang/dir per locale", () => {
  test("Hebrew root is rtl", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });

  test("English root is ltr", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("the server applies a valid theme cookie without a React script warning", async ({
    page,
    context,
  }) => {
    const scriptWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Encountered a script tag while rendering React component")) {
        scriptWarnings.push(message.text());
      }
    });
    await context.addCookies([
      { name: "theme", value: "daylight", url: "http://localhost:3000" },
    ]);

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("data-theme", "daylight");
    await expect(page.locator("#theme-bootstrap")).toHaveCount(0);
    expect(scriptWarnings).toEqual([]);
  });
});

test.describe("login page locale", () => {
  test("/login renders Hebrew (Auth.login.title)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(STR.he.loginTitle)).toBeVisible();
  });

  test("/en/login renders English (Auth.login.title)", async ({ page }) => {
    await page.goto("/en/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText(STR.en.loginTitle)).toBeVisible();
  });
});

test.describe("landing page locale", () => {
  test("/ shows the Hebrew marketing headline (Landing.hero.headlinePrefix)", async ({ page }) => {
    await page.goto("/");
    // The headline string also appears in the footer, so scope to the hero h1.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(STR.he.landingHeadline);
  });

  test("/en shows the English marketing headline (Landing.hero.headlinePrefix)", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(STR.en.landingHeadline);
    const marketingMain = page.getByRole("main");
    await expect(marketingMain).toContainText("$1,820");
    await expect(marketingMain).not.toContainText("₪");
  });
});

test.describe("legal pages locale (Legal.terms.title / Legal.privacy.title)", () => {
  test("/en/terms renders English", async ({ page }) => {
    await page.goto("/en/terms");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: STR.en.termsTitle })).toBeVisible();
  });

  test("/en/privacy renders English", async ({ page }) => {
    await page.goto("/en/privacy");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: STR.en.privacyTitle })).toBeVisible();
  });

  test("/terms renders Hebrew", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.getByRole("heading", { name: STR.he.termsTitle })).toBeVisible();
  });

  test("/accessibility is public and renders Hebrew", async ({ page }) => {
    await page.goto("/accessibility");
    await expect(page).toHaveURL(/\/accessibility$/);
    await expect(page.getByRole("heading", { name: STR.he.accessibilityTitle })).toBeVisible();
  });

  test("/en/accessibility renders English", async ({ page }) => {
    await page.goto("/en/accessibility");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: STR.en.accessibilityTitle })).toBeVisible();
  });
});

test.describe("locale switching via NEXT_LOCALE cookie preserves the path", () => {
  // The locale switcher (components/locale-switcher.tsx) calls
  // `router.replace(pathname, { locale })`, which sets the NEXT_LOCALE cookie
  // and re-routes the SAME path under the new locale. On public pages the
  // switcher UI lives only in the authed sidebar, so here we drive the exact
  // mechanism it relies on — the cookie — and assert path preservation.
  test("switching to en keeps the login path and flips to ltr", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    // Emulate the switcher setting NEXT_LOCALE=en, then revisit the same path.
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", url: "http://localhost:3000" },
    ]);
    await page.goto("/login");

    // The proxy restores the saved preference that localeDetection:false
    // intentionally leaves to our custom geo/cookie policy.
    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText(STR.en.loginTitle)).toBeVisible();
  });

  test("a he cookie keeps a prefix-less path Hebrew (rtl)", async ({ page, context }) => {
    // Note: an explicit `/en/...` URL is authoritative and the cookie will NOT
    // strip it (correct next-intl behaviour). The supported "switch back to he"
    // path is therefore the prefix-less route staying Hebrew under a he cookie.
    // The full bidirectional switcher CLICK (which DOES drop the prefix) is
    // covered in authed-smoke.spec.ts, where the sidebar switcher is visible.
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "he", url: "http://localhost:3000" },
    ]);
    await page.goto("/login");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page).not.toHaveURL(/\/en\//);
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(STR.he.loginTitle)).toBeVisible();
  });
});

test.describe("unauthenticated redirect preserves the locale prefix", () => {
  test("/en/dashboard → /en/login", async ({ page }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("/dashboard → /login (no /en prefix)", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page).not.toHaveURL(/\/en\//);
  });
});

test.describe("SEO surfaces", () => {
  test("/sitemap.xml is 200 and lists prefix-less + /en URLs with hreflang", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();

    // Prefix-less (Hebrew default) canonical login URL.
    expect(body).toContain("/login");
    // English alternate.
    expect(body).toMatch(/\/en(\/login)?/);
    // hreflang alternates for both locales.
    expect(body).toContain('hreflang="he"');
    expect(body).toContain('hreflang="en"');
  });

  test("/robots.txt is 200 and references the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.toLowerCase()).toContain("sitemap");
    expect(body).toContain("/sitemap.xml");
  });
});
