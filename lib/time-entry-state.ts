/**
 * The two implicit state machines on a time_entries row, defined once.
 *
 * Timer:   running (no end, not paused) · paused · stopped (end_time set)
 * Billing: non_billable · unbilled · billed (in a charge document) · written_off
 *
 * The SQL routes mirror these predicates in their WHERE clauses — keep in sync:
 *   running      start_time IS NOT NULL AND end_time IS NULL
 *   billable now end_time IS NOT NULL AND charge_document_id IS NULL
 *                AND is_billable AND written_off_at IS NULL
 *   editable     charge_document_id IS NULL
 */

export type TimerState = "running" | "paused" | "stopped";
export type BillingState = "non_billable" | "unbilled" | "billed" | "written_off";

/** Columns the predicates read (snake_case, as returned by raw SQL). */
export interface EntryStateRow {
  start_time: string | Date | null;
  end_time: string | Date | null;
  paused_at: string | Date | null;
  total_paused_time: number | null; // ms
  is_billable: boolean | null;
  charge_document_id: string | null;
  written_off_at: string | Date | null;
}

export function timerState(r: EntryStateRow): TimerState {
  if (r.end_time) return "stopped";
  return r.paused_at ? "paused" : "running";
}

/** Billed/written-off win over is_billable: they record what actually happened. */
export function billingState(r: EntryStateRow): BillingState {
  if (r.charge_document_id) return "billed";
  if (r.written_off_at) return "written_off";
  return r.is_billable === false ? "non_billable" : "unbilled";
}

/** An entry settled into a charge document is frozen (cancel the document first). */
export function canEditEntry(r: EntryStateRow): boolean {
  return billingState(r) !== "billed";
}

/** Only a stopped, unbilled entry can be claimed by a charge document. */
export function canBillEntry(r: EntryStateRow): boolean {
  return timerState(r) === "stopped" && billingState(r) === "unbilled";
}

/** Worked time of a timer at `now`: wall time minus closed pauses minus the open pause. */
export function timerElapsedMs(r: EntryStateRow, now: Date): number {
  if (!r.start_time) return 0;
  const end = r.end_time ? new Date(r.end_time) : now;
  let ms = end.getTime() - new Date(r.start_time).getTime() - (r.total_paused_time ?? 0);
  if (r.paused_at && !r.end_time) ms -= now.getTime() - new Date(r.paused_at).getTime();
  return Math.max(0, ms);
}
