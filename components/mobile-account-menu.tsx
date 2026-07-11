"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/navigation";
import { Users, FileText, Settings, LogOut } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

interface MobileAccountMenuProps {
  userEmail?: string;
  userName?: string | null;
}

const menuLinks = [
  { href: "/clients", labelKey: "clients", Icon: Users },
  { href: "/reports", labelKey: "reports", Icon: FileText },
  { href: "/settings", labelKey: "settings", Icon: Settings },
] as const;

/**
 * Mobile account sheet opened from the top-bar avatar. Houses the sections
 * pulled off the bottom nav (clients, settlement) plus settings and logout.
 * Reuses the shared Dialog sheet variant (focus trap, Escape, backdrop, RTL).
 */
export function MobileAccountMenu({ userEmail, userName }: MobileAccountMenuProps) {
  const t = useTranslations("Nav");
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const displayName = userName?.trim() || userEmail?.split("@")[0] || t("profileFallback");
  const avatarInitial = displayName.charAt(0).toUpperCase();

  // ponytail: logout logic duplicated from sidebar.tsx; extract a useLogout hook
  // if a third caller appears.
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        navigator.serviceWorker?.controller?.postMessage("CLEAR_CACHE");
        router.push("/login");
        router.refresh();
      } else {
        console.error("Logout failed:", data.message);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger
        aria-label={displayName}
        className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-sidebar-foreground/10 bg-sidebar-foreground/10 text-sm font-bold text-sidebar-foreground transition-[background-color,border-color] hover:border-sidebar-foreground/20 hover:bg-sidebar-foreground/15"
      >
        {avatarInitial}
      </DialogTrigger>
      <DialogContent variant="sheet" className="gap-0">
        <DialogHeader className="flex-row items-center gap-3 text-start space-y-0 pb-2">
          <div className="w-10 h-10 bg-accent text-accent-foreground rounded-full flex items-center justify-center shrink-0 font-bold uppercase">
            {avatarInitial}
          </div>
          <div className="flex flex-col min-w-0">
            <DialogTitle className="truncate">{displayName}</DialogTitle>
            {userEmail && (
              <DialogDescription className="truncate">{userEmail}</DialogDescription>
            )}
          </div>
        </DialogHeader>

        <nav className="mt-2 border-t border-border pt-2 space-y-1">
          {menuLinks.map(({ href, labelKey, Icon }) => (
            <DialogClose asChild key={href}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]"
              >
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{t(labelKey)}</span>
              </Link>
            </DialogClose>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {logoutLoading ? (
              <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
            ) : (
              <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>{logoutLoading ? t("loggingOut") : t("logout")}</span>
          </button>
        </nav>
      </DialogContent>
    </Dialog>
  );
}
