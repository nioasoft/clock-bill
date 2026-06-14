"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { useTimer } from "@/contexts/timer-context";

/**
 * Headless handler for the PWA manifest shortcut / deep link
 * `/dashboard?action=start-timer` — opens the start-timer modal, then strips the
 * param so it doesn't re-fire on back/refresh. Renders nothing.
 *
 * (The visible "start timer" entry point lives in the top bar on mobile — see
 * MobileNav — and the persistent bar / sidebar on desktop.)
 */
export function TimerDeepLink() {
  const { setShowTimerModal } = useTimer();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (searchParams.get("action") === "start-timer") {
      setShowTimerModal(true);
      router.replace(pathname);
    }
  }, [searchParams, setShowTimerModal, router, pathname]);

  return null;
}
