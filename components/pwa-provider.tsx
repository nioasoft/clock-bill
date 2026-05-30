"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "monit-pwa-install-dismissed";

/**
 * Registers the service worker and surfaces an "install app" prompt (Android/
 * desktop Chrome via beforeinstallprompt). iOS has no programmatic install, so
 * the banner simply never appears there — users use Share → Add to Home Screen.
 */
export function PwaProvider() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

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

  // Capture the install prompt.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

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

  if (!visible) return null;

  return (
    <div
      dir="rtl"
      className="fixed inset-x-3 z-50 mx-auto max-w-sm rounded-[var(--radius-card)] border border-border bg-card-elevated p-4 shadow-lg"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
      role="dialog"
      aria-label="התקנת האפליקציה"
    >
      <button
        onClick={dismiss}
        className="absolute top-2 start-2 rounded-md p-1 text-muted-foreground hover:bg-muted"
        aria-label="סגור"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">התקן את מוניט</p>
          <p className="text-xs text-muted-foreground">גישה מהירה ממסך הבית, גם ללא דפדפן.</p>
        </div>
      </div>
      <button
        onClick={install}
        className="mt-3 w-full rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        התקן אפליקציה
      </button>
    </div>
  );
}
