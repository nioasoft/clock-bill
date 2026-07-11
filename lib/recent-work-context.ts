const STORAGE_KEY = "clockbill.recent-work-context.v1";
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export interface RecentWorkContext {
  projectId: string;
  clientId: string;
  rateId?: string;
  billingKind: "hourly" | "item";
  updatedAt: number;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isRecentWorkContext(value: unknown, now: number): value is RecentWorkContext {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.projectId === "string" &&
    item.projectId.length > 0 &&
    typeof item.clientId === "string" &&
    typeof item.updatedAt === "number" &&
    now - item.updatedAt >= 0 &&
    now - item.updatedAt <= MAX_AGE_MS &&
    (item.billingKind === "hourly" || item.billingKind === "item") &&
    (item.rateId === undefined || typeof item.rateId === "string")
  );
}

export function readRecentWorkContext(
  storage: StorageLike | undefined = typeof window === "undefined" ? undefined : window.localStorage,
  now = Date.now()
): RecentWorkContext | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRecentWorkContext(parsed, now) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeRecentWorkContext(
  context: Omit<RecentWorkContext, "updatedAt">,
  storage: StorageLike | undefined = typeof window === "undefined" ? undefined : window.localStorage,
  now = Date.now()
): void {
  if (!storage || !context.projectId) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...context, updatedAt: now }));
  } catch {
    // A storage quota/privacy-mode failure must never block work capture.
  }
}

export { STORAGE_KEY as RECENT_WORK_CONTEXT_STORAGE_KEY };
