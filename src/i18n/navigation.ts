import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware wrappers. Importing Link/useRouter from here (instead of
// next/link, next/navigation) auto-prefixes the active locale, so call
// sites keep writing href="/dashboard".
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
