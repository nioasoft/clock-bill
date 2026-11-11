/**
 * Write the NEXT_LOCALE cookie. `localeDetection: false` means next-intl never
 * writes it for us, and proxy.ts redirects prefix-less (Hebrew) URLs to the
 * cookie's locale — so a stale "en" would bounce every switch back to /en.
 */
export function setLocaleCookie(locale: string): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;
}

/**
 * Persist an explicit language choice: cookie first, then the profile. Awaited
 * before navigating so app-layout's profile sync can't read the old locale and
 * switch back. Failures (e.g. 401 on public pages) are non-fatal.
 */
export async function persistLocale(locale: string): Promise<void> {
  setLocaleCookie(locale);
  try {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
  } catch (error) {
    console.error("Failed to persist locale:", error);
  }
}
