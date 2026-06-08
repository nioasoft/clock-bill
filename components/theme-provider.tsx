"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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
  const [theme, setThemeState] = useState(isThemeId(initialTheme) ? initialTheme : DEFAULT_THEME);

  const setTheme = useCallback((id: string) => {
    if (!isThemeId(id)) return;
    setThemeState((prev) => {
      document.documentElement.dataset.theme = id; // optimistic, no flash
      writeCookie(id);
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: id }),
      }).catch(() => {
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
