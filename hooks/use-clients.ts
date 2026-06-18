"use client";

/**
 * Shared clients/projects list queries.
 *
 * `/api/clients` and `/api/projects` (paramless) were each fetched independently
 * by several pages (entries, projects, clients, the task dialog) and by the
 * timer context on every page mount. These hooks funnel the paramless reads
 * through one cache key apiece, so the lists are fetched once and reused across
 * navigation. Each consumer passes its own element type; the runtime payload is
 * identical (same endpoint), so the boundary cast is safe.
 *
 * Mutations elsewhere should call `queryClient.invalidateQueries({ queryKey })`
 * with `clientsQueryKey` / `projectsQueryKey` to refresh the shared lists.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { usePathname } from "next/navigation";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

export const clientsQueryKey = ["clients"] as const;
export const projectsQueryKey = ["projects"] as const;

function useIsPublicRoute(): boolean {
  const pathname = usePathname();
  return PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );
}

async function fetchList<T>(url: string, field: "clients" | "projects"): Promise<T[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${field}`);
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message ?? `Failed to load ${field}`);
  return (data[field] ?? []) as T[];
}

/** Shared paramless GET /api/clients. Pass the consumer's own client type. */
export function useClients<T>(): UseQueryResult<T[]> {
  const isPublicRoute = useIsPublicRoute();
  return useQuery({
    queryKey: clientsQueryKey,
    queryFn: () => fetchList<T>("/api/clients", "clients"),
    enabled: !isPublicRoute,
  });
}

/** Shared paramless GET /api/projects. Pass the consumer's own project type. */
export function useProjects<T>(): UseQueryResult<T[]> {
  const isPublicRoute = useIsPublicRoute();
  return useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => fetchList<T>("/api/projects", "projects"),
    enabled: !isPublicRoute,
  });
}
