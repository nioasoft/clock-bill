"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { DEFAULT_THEME, isThemeId } from "@/lib/themes";
import { useProfile, usePatchProfile } from "@/hooks/use-profile";

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
  // Shared profile query (one fetch per page, deduped across all consumers).
  const { data: profile } = useProfile();
  const patchProfile = usePatchProfile();

  // On mount: sync state to the theme already on <html> / in the cookie.
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
    return () => {
      active = false;
    };
  }, []);

  // No cookie → new device. Apply the account's saved theme (from the shared
  // profile query) so it follows the user across devices — a one-time correction.
  // Re-check the cookie at apply time: if the user switched themes while the
  // profile was loading (which writes a cookie), don't clobber their choice.
  useEffect(() => {
    const saved = profile?.theme;
    if (!readCookie() && isThemeId(saved)) {
      // queueMicrotask keeps the setState out of the synchronous effect body
      // (react-hooks/set-state-in-effect); DOM + cookie are external systems.
      document.documentElement.dataset.theme = saved;
      writeCookie(saved);
      queueMicrotask(() => setThemeState(saved));
    }
  }, [profile?.theme]);

  const setTheme = useCallback(
    (id: string) => {
      if (!isThemeId(id)) return;
      setThemeState((prev) => {
        document.documentElement.dataset.theme = id; // optimistic, no flash
        writeCookie(id);
        patchProfile.mutate(
          { theme: id },
          {
            onError: () => {
              // rollback on failure
              setThemeState(prev);
              document.documentElement.dataset.theme = prev;
              writeCookie(prev);
            },
          }
        );
        return id;
      });
    },
    [patchProfile]
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
