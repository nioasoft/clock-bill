import { redirect } from "next/navigation";
import { getPathname } from "@/src/i18n/navigation";
import { getAdminUser } from "@/lib/admin";

/**
 * Server-side admin guard. The admin pages are "use client" with a client-side
 * role check, so without this layout the full admin bundle is shipped to a
 * non-admin before the client redirect fires. This runs on the server and
 * redirects non-admins to the dashboard before any admin UI is sent.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const admin = await getAdminUser();
  if (!admin) {
    redirect(getPathname({ href: "/dashboard", locale }));
  }
  return <>{children}</>;
}
