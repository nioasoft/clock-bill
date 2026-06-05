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
}

export const navItemDefs: NavItemDef[] = [
  { labelKey: "dashboard", href: "/", iconName: "Home" },
  { labelKey: "entries", href: "/entries", iconName: "Clock" },
  { labelKey: "tasks", href: "/tasks", iconName: "FolderKanban" },
  { labelKey: "clients", href: "/clients", iconName: "Users" },
  { labelKey: "reports", href: "/reports", iconName: "FileText" },
  { labelKey: "feedback", href: "/feedback", iconName: "MessageSquare" },
  { labelKey: "settings", href: "/settings", iconName: "Settings" },
  { labelKey: "admin", href: "/admin", iconName: "Shield", adminOnly: true },
];
