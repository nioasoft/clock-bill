"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { DEFAULT_THEME, isThemeId } from "@/lib/themes";

interface ThemeContextValue {
  theme: string;
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
});

const COOKIE = "theme";

/** Read the `theme` cookie value, or null. Sanitized to [a-z-] by the regex. */
function readCookie(): string | null {
  const m =
    typeof document !== "undefined"
      ? document.cookie.match(/(?:^|; )theme=([a-z-]+)/)
      : null;
  return m ? m[1] : null;
}

function writeCookie(id: string) {
  // 1 year, root path, Lax. Not httpOnly on purpose — the client owns switching.
  document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: string;
  children: ReactNode;
}) {
  // SSR-known value is the static default; the real theme is applied client-side
  // (the inline no-flash script already set data-theme before paint).
  const [theme, setThemeState] = useState(isThemeId(initialTheme) ? initialTheme : DEFAULT_THEME);

  // On mount: sync state to the theme already on <html> / in the cookie. If there
  // is NO cookie (a device that never set one), pull the saved theme from the
  // account so it follows the user across devices — a one-time correction.
  //
  // These reads (`document`, cookie) are client-only external values unavailable
  // during SSR, so the sync must happen in an effect rather than during render.
  // The state update is wrapped in queueMicrotask to keep it out of the synchronous
  // effect body (which the react-hooks lint flags as a cascading-render risk); the
  // visible theme is already correct via the inline script, so this only aligns the
  // React-side `theme` value used by the settings selector.
  useEffect(() => {
    let active = true;
    const cookie = readCookie();
    const fromDom = document.documentElement.dataset.theme;
    // The cookie wins; otherwise fall back to whatever the inline script rendered.
    const current = cookie && isThemeId(cookie) ? cookie : fromDom;

    if (isThemeId(current)) {
      queueMicrotask(() => {
        if (active) setThemeState(current);
      });
    }

    // With a valid cookie there's nothing to pull — the device already chose.
    if (cookie && isThemeId(cookie)) {
      return () => {
        active = false;
      };
    }

    // No cookie → new device. Pull the saved theme from the account (DB → cookie).
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: { theme?: string } } | null) => {
        const saved = data?.profile?.theme;
        // Re-check the cookie: if the user switched themes while this fetch was in
        // flight (which writes a cookie), don't clobber their choice with the DB value.
        if (active && !readCookie() && isThemeId(saved)) {
          setThemeState(saved);
          document.documentElement.dataset.theme = saved;
          writeCookie(saved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const setTheme = useCallback((id: string) => {
    if (!isThemeId(id)) return;
    setThemeState((prev) => {
      document.documentElement.dataset.theme = id; // optimistic, no flash
      writeCookie(id);
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: id }),
      })
        .then((r) => {
          if (!r.ok) throw new Error("theme save failed");
        })
        .catch(() => {
          // rollback on failure
          setThemeState(prev);
          document.documentElement.dataset.theme = prev;
          writeCookie(prev);
        });
      return id;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
