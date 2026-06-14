"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/src/i18n/navigation";
import { Sidebar } from "./sidebar";
import { BrandMark } from "./brand-mark";
import { MobileNav } from "./mobile-nav";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ErrorBoundary } from "./error-boundary";
import { PersistentTimerBar } from "./persistent-timer-bar";
import { TimerStartModal } from "./timer-start-modal";
import { TimerStopModal } from "./timer-stop-modal";
import { TimerDeepLink } from "./timer-deeplink";
import { brandName } from "@/lib/brand";

interface User {
  id: string;
  email: string;
  role?: string;
  name?: string | null;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Guards the stored-locale sync so it runs once and can never loop.
  const localeSyncedRef = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (data.success && data.user) {
          setUser(data.user);
          // Apply a business name captured at signup. Email verification means
          // the profile PATCH can't run during registration (no session yet),
          // so it's stashed and applied here on the first authenticated load.
          const pendingBusinessName = localStorage.getItem("pendingBusinessName");
          if (pendingBusinessName) {
            localStorage.removeItem("pendingBusinessName");
            void fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ businessName: pendingBusinessName }),
            }).catch(() => {
              // Non-fatal: the user can set the business name later in settings.
            });
          }
        } else {
          document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          router.push("/login");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  // Apply the user's saved interface-language preference. Runs once per mount
  // (ref-guarded → no redirect loop): if the stored locale differs from the
  // active one, set the NEXT_LOCALE cookie so the next navigation/visit honors
  // it, then do a single soft switch to the stored locale. The switcher in
  // Settings remains the way to change it explicitly.
  useEffect(() => {
    if (!user || localeSyncedRef.current) return;
    localeSyncedRef.current = true;

    const syncLocale = async () => {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        const stored: unknown = data?.profile?.locale;
        if ((stored === "he" || stored === "en") && stored !== locale) {
          // Persist so a hard reload / new visit picks it up immediately.
          document.cookie = `NEXT_LOCALE=${stored}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          // Single soft switch to the stored locale on the current path.
          router.replace(pathname, { locale: stored });
        }
      } catch {
        // Non-fatal: the UI stays on the current locale; the user can switch
        // manually in Settings.
      }
    };

    void syncLocale();
  }, [user, locale, router, pathname]);

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-2xl flex items-center justify-center animate-pulse">
              <BrandMark className="h-9 w-9 text-primary-foreground" />
            </div>
            <div className="absolute -inset-2 border-2 border-accent/20 rounded-2xl animate-ping" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-xl font-display font-bold text-foreground">{brandName(locale)}</h2>
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileNav userEmail={user.email} userRole={user.role} />
      <div className="hidden lg:flex">
        <div className="fixed ltr:left-0 rtl:right-0 top-0 h-screen z-30">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
            userRole={user.role}
            userName={user.name}
            userEmail={user.email}
          />
        </div>
        <div
          className={`flex-1 min-h-screen flex flex-col transition-[margin] duration-200 ${
            sidebarCollapsed ? "ms-16" : "ms-64"
          }`}
        >
          <PersistentTimerBar />
          <main className="flex-1 overflow-x-hidden motion-safe:animate-fade-in">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
      <div className="lg:hidden pb-16 min-h-screen flex flex-col">
        <PersistentTimerBar />
        {/* pb clears the fixed bottom nav so the last element isn't hidden. */}
        <main className="flex-1 overflow-x-hidden pb-6 motion-safe:animate-fade-in">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <MobileBottomNav />
      </div>
      <TimerStartModal />
      <TimerStopModal />
      <Suspense fallback={null}>
        <TimerDeepLink />
      </Suspense>
    </div>
  );
}
