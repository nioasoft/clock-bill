/**
 * Trial lifecycle helpers (no I/O). The 14-day Unlimited trial begins on
 * signup for non-founding users. See lib/plans.ts for the day count.
 */
import { computeTrialEnd } from "@/lib/plans";

/** Compute the trial window for a new account starting now. */
export function buildTrialStart(now: Date): { startedAt: Date; endsAt: Date } {
  return { startedAt: now, endsAt: computeTrialEnd(now) };
}
