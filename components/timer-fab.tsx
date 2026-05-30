"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Play } from "lucide-react";
import { useTimer } from "@/contexts/timer-context";
import { haptic } from "@/lib/haptics";

/**
 * Mobile floating action button to start a timer from anywhere in the app.
 * Hidden on desktop (the persistent bar / sidebar cover it) and while a timer
 * is already running. Also handles the `?action=start-timer` deep link used by
 * the PWA manifest shortcut.
 */
export function TimerFab() {
  const { runningTimer, setShowTimerModal } = useTimer();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // PWA shortcut / deep link: /dashboard?action=start-timer opens the modal.
  useEffect(() => {
    if (searchParams.get("action") === "start-timer" && !runningTimer) {
      setShowTimerModal(true);
      // Strip the param so it doesn't re-trigger on back/refresh.
      router.replace(pathname);
    }
  }, [searchParams, runningTimer, setShowTimerModal, router, pathname]);

  // While a timer runs, the persistent bar handles control — hide the FAB.
  if (runningTimer) return null;

  return (
    <button
      type="button"
      onClick={() => {
        haptic("light");
        setShowTimerModal(true);
      }}
      aria-label="התחל טיימר"
      className="lg:hidden fixed end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-90"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
    >
      <Play className="h-6 w-6 fill-current" />
    </button>
  );
}
