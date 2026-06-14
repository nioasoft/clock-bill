"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { Play } from "lucide-react";
import { useTimer } from "@/contexts/timer-context";
import { haptic } from "@/lib/haptics";

/**
 * Mobile floating action button to start a timer from anywhere in the app.
 * Hidden on desktop (the persistent bar / sidebar cover it). Always available so
 * an additional (parallel) timer can be started even while others run. Also
 * handles the `?action=start-timer` deep link used by the PWA manifest shortcut.
 */
export function TimerFab() {
  const t = useTranslations("Timer");
  const { setShowTimerModal } = useTimer();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Hide while the user scrolls DOWN (reading / reaching for content actions, so
  // the FAB never sits over an end-aligned button), reveal on scroll UP or near
  // the top. Resolves the FAB-over-content overlap without removing the single
  // always-available mobile timer entry point.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const prev = lastY.current;
      // Always reveal near the top or on any upward scroll; only hide while
      // actively scrolling down past a small threshold. 6px dead-zone kills
      // sub-pixel jitter. Explicit reveal conditions guarantee the FAB can
      // never get stuck off-screen.
      if (y <= 80 || y < prev - 6) {
        setHidden(false);
      } else if (y > prev + 6) {
        setHidden(true);
      }
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // PWA shortcut / deep link: /dashboard?action=start-timer opens the modal.
  useEffect(() => {
    if (searchParams.get("action") === "start-timer") {
      setShowTimerModal(true);
      // Strip the param so it doesn't re-trigger on back/refresh.
      router.replace(pathname);
    }
  }, [searchParams, setShowTimerModal, router, pathname]);

  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        setShowTimerModal(true);
      }}
      aria-label={t("bar.startTimer")}
      className={`lg:hidden fixed end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 active:scale-90 ${
        hidden ? "pointer-events-none translate-y-24 opacity-0" : "translate-y-0 opacity-100"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
    >
      <Play className="h-6 w-6 fill-current" />
    </button>
  );
}
