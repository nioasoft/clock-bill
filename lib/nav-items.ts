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
  // Clients + reports are pulled off the mobile bottom bar to keep it to 4 tabs
  // (dashboard/entries/tasks/settings). On mobile they live in the avatar
  // account sheet (see mobile-account-menu.tsx); the desktop sidebar ignores
  // mobileHidden and still shows them.
  { labelKey: "clients", href: "/clients", iconName: "Users", mobileHidden: true },
  { labelKey: "reports", href: "/reports", iconName: "FileText", mobileHidden: true },
  // Feedback is also off the mobile bar — reachable from the settings page.
  { labelKey: "feedback", href: "/feedback", iconName: "MessageSquare", mobileHidden: true },
  { labelKey: "settings", href: "/settings", iconName: "Settings" },
  { labelKey: "admin", href: "/admin", iconName: "Shield", adminOnly: true },
];
