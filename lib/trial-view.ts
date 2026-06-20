/** Pure view-model for the trial pill/card. No I/O, no React. */
export interface TrialInfo { active: boolean; daysLeft: number | null; endsAt: string | null; }
export interface TrialPillView { show: boolean; daysLeft: number; ending: boolean; }

/** Trial UI is shown only while active; "ending" within 3 days. */
export function getTrialPillView(trial: TrialInfo | null): TrialPillView | null {
  if (!trial || !trial.active) return null;
  const daysLeft = trial.daysLeft ?? 0;
  return { show: true, daysLeft, ending: daysLeft <= 3 };
}
