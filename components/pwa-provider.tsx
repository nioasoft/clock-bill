"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Share, X } from "lucide-react";
import { usePathname } from "@/src/i18n/navigation";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "monit-pwa-install-dismissed";
const IOS_DISMISS_KEY = "monit-ios-install-dismissed";

// The banner is a fixed bottom overlay (z-50). On mobile it sits exactly on top
// of the submit button of the auth forms (a tap on "הרשם" hit the banner and
// silently did nothing — registration was impossible on mobile). Never show it
// on auth flow pages; the SW registration below still runs everywhere.
const SUPPRESSED_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

// Scroll clearance reserved at the bottom of the page while a banner is shown,
// so content at max scroll (footer CTAs etc.) can always scroll out from under
// the fixed overlay: banner height (≤ ~150px) + its bottom offset (5rem) + gap.
const BANNER_CLEARANCE_PX = 240;

/**
 * Registers the service worker and surfaces an "install app" prompt (Android/
 * desktop Chrome via beforeinstallprompt). iOS has no programmatic install, so
 * the banner simply never appears there — users use Share → Add to Home Screen.
 */
export function PwaProvider() {
  const t = useTranslations("Pwa");
  // Locale-stripped pathname (e.g. "/en/register" -> "/register").
  const pathname = usePathname();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  // iOS has no beforeinstallprompt; we show a manual "Add to Home Screen" hint.
  const [iosHintVisible, setIosHintVisible] = useState(false);

  // Register the service worker (production only — dev has no /sw.js caching needs).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.error("SW registration failed", err);
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Capture the install prompt. Only surface the banner on mobile — on desktop
  // it's noise (the user asked to keep it mobile-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      if (isMobile) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // iOS Safari can't fire beforeinstallprompt — installation is manual via
  // Share → Add to Home Screen. Detect iOS Safari (not already installed, not
  // dismissed) and show an instructional hint instead.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(IOS_DISMISS_KEY) === "1") return;
    const ua = window.navigator.userAgent;
    const nav = window.navigator as Navigator & { standalone?: boolean; platform?: string };
    const isIOS =
      /iphone|ipad|ipod/i.test(ua) ||
      (nav.platform === "MacIntel" && nav.maxTouchPoints > 1); // iPadOS reports as Mac
    // Add to Home Screen only works in Safari on iOS, not Chrome/Firefox/Edge iOS.
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    // Client-only capability detection has to run post-mount, so setting state
    // here is intentional (SSR has no navigator; the value can't be derived).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIOS && isSafari && !isStandalone) setIosHintVisible(true);
  }, []);

  // Auth pages: the overlay covers the form's submit button — never render it
  // there (the install prompt event stays captured for later pages).
  const suppressed = SUPPRESSED_ROUTES.some((route) => pathname.startsWith(route));

  // While a banner is shown, reserve scroll space at the bottom of the document
  // so nothing interactive can get trapped underneath the fixed overlay at max
  // scroll (the register submit button was unreachable this way; same risk for
  // bottom CTAs on any page).
  const bannerShown = !suppressed && (visible || iosHintVisible);
  useEffect(() => {
    if (!bannerShown) return;
    const previous = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `${BANNER_CLEARANCE_PX}px`;
    return () => {
      document.body.style.paddingBottom = previous;
    };
  }, [bannerShown]);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setVisible(false);
    setInstallEvent(null);
  };

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
  };

  const dismissIos = () => {
    setIosHintVisible(false);
    try {
      localStorage.setItem(IOS_DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
  };

  if (suppressed) {
    return null;
  }

  // iOS instructional hint (no programmatic install). Shown only when the
  // Android/desktop prompt isn't available.
  if (!visible && iosHintVisible) {
    return (
      <div
        className="fixed inset-x-3 z-50 mx-auto max-w-sm rounded-[var(--radius-card)] border border-border bg-card-elevated p-4 shadow-lg"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
        role="dialog"
        aria-label={t("dialogLabel")}
      >
        <button
          onClick={dismissIos}
          className="absolute top-2 end-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pe-7">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t("installTitle")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {t.rich("iosInstructions", {
                icon: () => (
                  <Share
                    className="mx-1 inline h-3.5 w-3.5 align-text-bottom"
                    aria-label={t("shareIconLabel")}
                  />
                ),
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 z-50 mx-auto max-w-sm rounded-[var(--radius-card)] border border-border bg-card-elevated p-4 shadow-lg"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
      role="dialog"
      aria-label={t("dialogLabel")}
    >
      <button
        onClick={dismiss}
        className="absolute top-2 end-2 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
        aria-label={t("close")}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3 pe-7">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t("installTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("installSubtitle")}</p>
        </div>
      </div>
      <button
        onClick={install}
        className="mt-3 w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t("installButton")}
      </button>
    </div>
  );
}
