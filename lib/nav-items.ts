/**
 * Shared navigation items used by sidebar, mobile nav, and bottom nav.
 *
 * Each item carries a stable `labelKey` into the `Nav` message namespace
 * (resolved with `useTranslations("Nav")` at the call site) so labels localize
 * — the `href`/`iconName` stay locale-independent.
 */

export interface NavItemDef {
  /** Message key under the `Nav` namespace, e.g. "dashboard". */
  labelKey:
    | "dashboard"
    | "entries"
    | "tasks"
    | "clients"
    | "reports"
    | "feedback"
    | "settings"
    | "admin";
  href: string;
  iconName: "Home" | "Clock" | "Users" | "FolderKanban" | "FileText" | "MessageSquare" | "Settings" | "Shield";
  adminOnly?: boolean;
  /** Excluded from the mobile bottom nav (still shown in the desktop sidebar). */
  mobileHidden?: boolean;
  /**
   * Shorter label for the mobile bottom nav, where each item gets ~60px and a
   * long label gets ellipsized. Message key under the `Nav` namespace.
   */
  mobileLabelKey?: "entriesMobile";
}

export const navItemDefs: NavItemDef[] = [
  { labelKey: "dashboard", href: "/", iconName: "Home" },
  { labelKey: "entries", href: "/entries", iconName: "Clock", mobileLabelKey: "entriesMobile" },
  { labelKey: "tasks", href: "/tasks", iconName: "FolderKanban" },
  { labelKey: "clients", href: "/clients", iconName: "Users" },
  { labelKey: "reports", href: "/reports", iconName: "FileText" },
  // The bottom nav has no room for 7 items — feedback is reachable from the
  // settings page on mobile instead.
  { labelKey: "feedback", href: "/feedback", iconName: "MessageSquare", mobileHidden: true },
  { labelKey: "settings", href: "/settings", iconName: "Settings" },
  { labelKey: "admin", href: "/admin", iconName: "Shield", adminOnly: true },
];
