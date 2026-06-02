/**
 * Shared navigation items used by sidebar, mobile nav, and bottom nav
 */

export interface NavItemDef {
  name: string;
  href: string;
  iconName: "Home" | "Clock" | "Users" | "FolderKanban" | "FileText" | "MessageSquare" | "Settings" | "Shield";
  adminOnly?: boolean;
}

export const navItemDefs: NavItemDef[] = [
  { name: "דשבורד", href: "/", iconName: "Home" },
  { name: "רשומות חיוב", href: "/entries", iconName: "Clock" },
  { name: "לקוחות", href: "/clients", iconName: "Users" },
  { name: "התחשבנות", href: "/reports", iconName: "FileText" },
  { name: "פניות", href: "/feedback", iconName: "MessageSquare" },
  { name: "הגדרות", href: "/settings", iconName: "Settings" },
  { name: "ניהול", href: "/admin", iconName: "Shield", adminOnly: true },
];
