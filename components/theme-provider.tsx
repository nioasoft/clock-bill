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

  // Keep the DOM `data-theme` and the React state aligned with the source of
  // truth across mounts and navigations. This is critical: the root layout
  // renders `<html data-theme={DEFAULT_THEME}>`, so a locale switch (which
  // re-renders the layout tree) RESETS the attribute back to the default and
  // clobbers the runtime theme. The inline no-flash script only runs on a full
  // document load, not on client navigations — so we must re-assert here.
  //
  // Resolution order: the `theme` cookie (the user's most recent local choice)
  // wins; otherwise the account's saved theme (new device / cleared cookie);
  // otherwise whatever is already on <html>. We re-write the DOM attribute (to
  // undo a layout reset) and persist the cookie when only the account had it.
  // Runs on mount and whenever the saved profile theme loads. The state update
  // is wrapped in queueMicrotask to keep it out of the synchronous effect body
  // (react-hooks/set-state-in-effect); DOM + cookie are external systems.
  useEffect(() => {
    let active = true;
    const cookie = readCookie();
    const saved = profile?.theme;
    const resolved =
      cookie && isThemeId(cookie)
        ? cookie
        : isThemeId(saved)
          ? saved
          : document.documentElement.dataset.theme;

    if (isThemeId(resolved)) {
      document.documentElement.dataset.theme = resolved;
      if (!cookie) writeCookie(resolved);
      queueMicrotask(() => {
        if (active) setThemeState(resolved);
      });
    }
    return () => {
      active = false;
    };
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
