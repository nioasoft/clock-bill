/**
 * Trial email schedule (pure). One email per cron run per user: the highest
 * milestone the user has reached that hasn't been sent yet — so a missed cron
 * day never sends stale earlier content. Day-0 welcome is handled at signup,
 * not here.
 */
export type TrialEmailKey = "trial_d3" | "trial_d7" | "trial_d11" | "trial_ended" | "trial_winback";

/** Ordered ascending by the day offset (from trial start) at which each unlocks. */
export const TRIAL_EMAIL_MILESTONES: ReadonlyArray<{ key: TrialEmailKey; day: number }> = [
  { key: "trial_d3", day: 3 },
  { key: "trial_d7", day: 7 },
  { key: "trial_d11", day: 11 },
  { key: "trial_ended", day: 14 },
  { key: "trial_winback", day: 17 },
];

/** The single email due now: highest reached milestone not already sent, else null. */
export function pickDueEmail(daysSinceStart: number, sentKeys: ReadonlySet<string>): TrialEmailKey | null {
  for (let i = TRIAL_EMAIL_MILESTONES.length - 1; i >= 0; i--) {
    const m = TRIAL_EMAIL_MILESTONES[i];
    if (daysSinceStart >= m.day && !sentKeys.has(m.key)) return m.key;
  }
  return null;
}
