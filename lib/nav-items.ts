/**
 * Shared navigation items used by sidebar, mobile nav, and bottom nav
 */

export interface NavItemDef {
  name: string;
  href: string;
  iconName: "Home" | "Clock" | "Users" | "FolderKanban" | "FileText" | "Settings";
}

export const navItemDefs: NavItemDef[] = [
  { name: "דשבורד", href: "/", iconName: "Home" },
  { name: "רשומות זמן", href: "/entries", iconName: "Clock" },
  { name: "לקוחות", href: "/clients", iconName: "Users" },
  { name: "פרויקטים", href: "/projects", iconName: "FolderKanban" },
  { name: "דוחות", href: "/reports", iconName: "FileText" },
  { name: "הגדרות", href: "/settings", iconName: "Settings" },
];
