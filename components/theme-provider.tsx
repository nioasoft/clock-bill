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
  // Secure over HTTPS (omitted on http://localhost so dev still sets it).
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; samesite=lax${secure}`;
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: string;
  children: ReactNode;
}) {
  // The server resolves the validated theme cookie before rendering, so React
  // state and <html data-theme> begin with the same value.
  const [theme, setThemeState] = useState(isThemeId(initialTheme) ? initialTheme : DEFAULT_THEME);
  // Shared profile query (one fetch per page, deduped across all consumers).
  const { data: profile } = useProfile();
  const patchProfile = usePatchProfile();

  // Keep the DOM `data-theme` and the React state aligned with the source of
  // truth across mounts, profile loading, and client navigations. The server
  // already applies the cookie on full document requests; this effect also
  // handles an account theme arriving after hydration on a new device.
  //
  // Resolution order: the `theme` cookie (the user's most recent local choice)
  // wins; otherwise the account's saved theme (new device / cleared cookie);
  // otherwise whatever is already on <html>. We re-write the DOM attribute and
  // persist the cookie when only the account had it.
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
