import { test, expect } from "@playwright/test";
import { STR } from "./i18n-strings";

/**
 * Authenticated i18n smoke. GUARDED: skips cleanly (never fails) unless both
 * E2E_EMAIL and E2E_PASSWORD are set. With creds it:
 *   1. Logs in through the real /en/login form.
 *   2. Asserts the English dashboard chrome (sidebar "Dashboard"/"Settings",
 *      "Welcome!") with html[dir="ltr"] and the sidebar on the LEFT.
 *   3. Uses the in-sidebar locale switcher to flip to Hebrew, then asserts
 *      /dashboard (prefix dropped), rtl, and the Hebrew sidebar.
 *
 * Selectors prefer roles/translated text from the catalogs so they survive
 * styling changes.
 */

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

test.describe("authed i18n smoke", () => {
  test.skip(
    !EMAIL || !PASSWORD,
    "set E2E_EMAIL/E2E_PASSWORD to run authed tests",
  );

  test("English dashboard, then switch to Hebrew", async ({ page }) => {
    // --- 1. Log in via the English login form -----------------------------
    await page.goto("/en/login");
    await expect(page.getByText(STR.en.loginTitle)).toBeVisible();

    await page.locator("#email").fill(EMAIL!);
    await page.locator("#password").fill(PASSWORD!);
    await page.getByRole("button", { name: STR.en.loginTitle }).first().click()
      .catch(async () => {
        // Fallback: submit the form if the button label differs.
        await page.locator('form button[type="submit"]').first().click();
      });

    // --- 2. English dashboard chrome --------------------------------------
    await page.waitForURL(/\/en\/dashboard/, { timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await expect(page.getByText(STR.en.dashboardWelcome)).toBeVisible();

    const enSidebar = page.getByRole("navigation");
    await expect(enSidebar.getByText(STR.en.navDashboard)).toBeVisible();
    await expect(enSidebar.getByText(STR.en.navSettings)).toBeVisible();

    // Sidebar sits on the LEFT in LTR: its left edge is near the viewport's.
    const box = await enSidebar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeLessThan(80);

    // --- 3. Switch to Hebrew via the sidebar switcher ---------------------
    await page.getByRole("button", { name: STR.en.switcherHe }).click();

    await page.waitForURL(/\/dashboard$/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/\/en\//);
    await expect(page.locator("html")).toHaveAttribute("lang", "he");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

    const heSidebar = page.getByRole("navigation");
    await expect(heSidebar.getByText(STR.he.navDashboard)).toBeVisible();
    await expect(heSidebar.getByText(STR.he.navSettings)).toBeVisible();
  });
});
