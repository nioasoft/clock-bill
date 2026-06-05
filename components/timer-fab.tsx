"use client";

import { useEffect } from "react";
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
      className="lg:hidden fixed end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-90"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
    >
      <Play className="h-6 w-6 fill-current" />
    </button>
  );
}
